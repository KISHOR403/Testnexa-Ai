const supabaseService = require('../services/supabaseData.service');
const logger = require('../utils/logger');

/**
 * Auto-generate a title from the requirement text
 */
const generateTitle = (requirement) => {
    if (!requirement || !requirement.trim()) return 'Untitled Session';
    const firstSentence = requirement.split(/[.!?\n]/)[0].trim();
    if (firstSentence.length <= 50) return firstSentence;
    return firstSentence.slice(0, 47) + '...';
};

/**
 * LIST sessions for the authenticated user
 * GET /api/v1/sessions
 */
const listSessions = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);

        const result = await supabaseService.listSessions({
            userId,
            page,
            limit,
            status: req.query.status,
            search: req.query.search,
            sort: req.query.sort
        });

        return res.json({
            success: true,
            data: result.sessions,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages
            }
        });
    } catch (error) {
        logger.error('Error listing sessions', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * CREATE a new session
 * POST /api/v1/sessions
 */
const createSession = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { requirement, context, depth, title, suiteData, summary, quality, status, generationId } = req.body;

        const session = await supabaseService.createSession({
            userId,
            title: title || generateTitle(requirement),
            requirement: requirement || '',
            context: context || 'web',
            depth: depth || 'Standard',
            status: status || 'Draft',
            suiteData: suiteData || null,
            summary: summary || {},
            quality: quality || {},
            generationId: generationId || '',
            messages: requirement && requirement.trim()
                ? [{ role: 'user', content: requirement, timestamp: new Date().toISOString() }]
                : []
        });

        return res.status(201).json({
            success: true,
            data: session
        });
    } catch (error) {
        logger.error('Error creating session', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET a single session with full data
 * Supports direct owner access as well as shared links with role enforcement
 * GET /api/v1/sessions/:id
 */
const getSession = async (req, res) => {
    try {
        const userId = req.user ? (req.user._id || req.user.id) : null;
        const sessionId = req.params?.id;
        const shareToken = req.query?.token || req.query?.share || req.headers?.['x-share-token'];

        if (!sessionId) {
            return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'Invalid session ID' });
        }

        const result = await supabaseService.getSharedSession(sessionId, shareToken, userId);
        if (result.error) {
            return res.status(result.status || 500).json({
                success: false,
                code: result.error,
                message: result.message
            });
        }

        return res.json({ success: true, data: result.session });
    } catch (error) {
        logger.error('Error getting session', error);
        res.status(500).json({ success: false, code: 'SERVER_ERROR', message: error.message });
    }
};

/**
 * UPDATE a session (partial update)
 * Enforces role-based permissions:
 * - Owners and Editors can modify suiteData, title, status, etc.
 * - Reviewers can only update approvals/review status
 * - Viewers are strictly read-only
 * PATCH /api/v1/sessions/:id
 */
const updateSession = async (req, res) => {
    try {
        const userId = req.user ? (req.user._id || req.user.id) : null;
        const sessionId = req.params?.id;
        const shareToken = req.query?.token || req.query?.share || req.headers?.['x-share-token'];

        if (!sessionId) {
            return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'Invalid session ID' });
        }

        const checkResult = await supabaseService.getSharedSession(sessionId, shareToken, userId);
        if (checkResult.error) {
            return res.status(checkResult.status || 403).json({
                success: false,
                code: checkResult.error,
                message: checkResult.message
            });
        }

        const session = checkResult.session;
        const accessRole = session.accessRole || 'viewer';

        if (accessRole === 'viewer') {
            return res.status(403).json({
                success: false,
                code: 'PERMISSION_DENIED',
                message: 'Viewer role is read-only and does not have permission to modify this test suite'
            });
        }

        if (accessRole === 'reviewer') {
            const updates = {};
            if (req.body.status !== undefined) updates.status = req.body.status;
            if (req.body.suiteData !== undefined) updates.suiteData = req.body.suiteData;

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_UPDATE',
                    message: 'Reviewers can only update approval status'
                });
            }

            const updated = await supabaseService.updateSession(sessionId, null, updates);
            return res.json({ success: true, data: { ...updated, accessRole } });
        }

        // Owner or Editor
        if (req.body.pushMessage) {
            const msg = req.body.pushMessage;
            const messages = [...(session.messages || []), {
                role: msg.role || 'user',
                content: msg.content,
                timestamp: new Date().toISOString()
            }];
            const updated = await supabaseService.updateSession(sessionId, null, { messages });
            return res.json({ success: true, data: { ...updated, accessRole } });
        }

        const allowedFields = [
            'title', 'status', 'requirement', 'context', 'depth',
            'messages', 'suiteData', 'summary', 'quality', 'currentVersion', 'versions'
        ];

        const updates = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        if (updates.requirement && (session.title === 'Untitled Session' || !session.title)) {
            updates.title = generateTitle(updates.requirement);
        }

        const updated = await supabaseService.updateSession(sessionId, null, updates);
        return res.json({ success: true, data: { ...updated, accessRole } });
    } catch (error) {
        logger.error('Error updating session', error);
        res.status(500).json({ success: false, code: 'SERVER_ERROR', message: error.message });
    }
};

/**
 * DELETE a session (strictly owner only)
 * DELETE /api/v1/sessions/:id
 */
const deleteSession = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const sessionId = req.params.id;

        if (!sessionId) {
            return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'Invalid session ID' });
        }

        // Strictly verify that the caller is the owner
        const existing = await supabaseService.getSession(sessionId, userId);
        if (!existing) {
            return res.status(404).json({ success: false, code: 'SUITE_NOT_FOUND', message: 'Session not found or access denied' });
        }

        await supabaseService.deleteSession(sessionId, userId);
        return res.json({ success: true, message: 'Session deleted' });
    } catch (error) {
        logger.error('Error deleting session', error);
        res.status(500).json({ success: false, code: 'SERVER_ERROR', message: error.message });
    }
};

/**
 * CREATE or UPDATE share configuration for a test suite
 * POST /api/v1/sessions/:id/share
 */
const createShare = async (req, res) => {
    try {
        const userId = req.user ? (req.user._id || req.user.id) : null;
        const sessionId = req.params?.id;
        const { role = 'reviewer', isPublic = true, status = 'active' } = req.body || {};

        if (!sessionId) {
            return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'Invalid session ID' });
        }

        const session = await supabaseService.getSession(sessionId, userId);
        if (!session) {
            return res.status(404).json({ success: false, code: 'SUITE_NOT_FOUND', message: 'Test suite not found or access denied' });
        }

        const shareRecord = await supabaseService.createOrUpdateSuiteShare({
            suiteId: sessionId,
            ownerId: userId,
            role,
            isPublic,
            status
        });

        return res.json({
            success: true,
            data: shareRecord
        });
    } catch (error) {
        logger.error('Error creating share config', error);
        res.status(500).json({ success: false, code: 'SERVER_ERROR', message: error.message });
    }
};

/**
 * GET current share configuration for a test suite
 * GET /api/v1/sessions/:id/share
 */
const getShare = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const sessionId = req.params.id;

        if (!sessionId) {
            return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'Invalid session ID' });
        }

        const session = await supabaseService.getSession(sessionId, userId);
        if (!session) {
            return res.status(404).json({ success: false, code: 'SUITE_NOT_FOUND', message: 'Test suite not found or access denied' });
        }

        let share = await supabaseService.getSuiteShare(sessionId);
        if (!share) {
            share = await supabaseService.createOrUpdateSuiteShare({
                suiteId: sessionId,
                ownerId: userId,
                role: 'reviewer',
                isPublic: true,
                status: 'active'
            });
        }

        return res.json({ success: true, data: share });
    } catch (error) {
        logger.error('Error getting share config', error);
        res.status(500).json({ success: false, code: 'SERVER_ERROR', message: error.message });
    }
};

/**
 * REVOKE share link for a test suite
 * DELETE /api/v1/sessions/:id/share
 */
const revokeShare = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const sessionId = req.params.id;

        if (!sessionId) {
            return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'Invalid session ID' });
        }

        const revoked = await supabaseService.revokeSuiteShare(sessionId, userId);
        return res.json({ success: true, message: 'Share link revoked', data: revoked });
    } catch (error) {
        logger.error('Error revoking share link', error);
        res.status(error.statusCode || 500).json({ success: false, code: error.code || 'SERVER_ERROR', message: error.message });
    }
};

/**
 * GET version history for a session
 * GET /api/v1/sessions/:id/versions
 */
const getVersions = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const sessionId = req.params.id;

        if (!sessionId) {
            return res.status(400).json({ success: false, message: 'Invalid session ID' });
        }

        const session = await supabaseService.getSession(sessionId, userId);
        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        return res.json({
            success: true,
            data: {
                currentVersion: session.currentVersion || 1,
                versions: (session.versions || []).map(v => ({
                    versionNumber: v.versionNumber,
                    summary: v.summary,
                    createdAt: v.createdAt
                }))
            }
        });
    } catch (error) {
        logger.error('Error getting versions', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * CREATE a new version snapshot
 * POST /api/v1/sessions/:id/versions
 */
const createVersion = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const sessionId = req.params.id;

        if (!sessionId) {
            return res.status(400).json({ success: false, message: 'Invalid session ID' });
        }

        const session = await supabaseService.getSession(sessionId, userId);
        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }
        if (!session.suiteData || Object.keys(session.suiteData).length === 0) {
            return res.status(400).json({ success: false, message: 'No suite data to version' });
        }

        const newVersionNumber = (session.currentVersion || 1) + 1;
        const versions = [...(session.versions || []), {
            versionNumber: newVersionNumber,
            suiteData: session.suiteData,
            summary: session.summary,
            createdAt: new Date().toISOString()
        }];

        await supabaseService.updateSession(sessionId, userId, {
            currentVersion: newVersionNumber,
            versions
        });

        return res.status(201).json({
            success: true,
            data: {
                versionNumber: newVersionNumber,
                totalVersions: versions.length
            }
        });
    } catch (error) {
        logger.error('Error creating version', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
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
};
