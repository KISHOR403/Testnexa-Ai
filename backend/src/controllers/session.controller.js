const WorkspaceSession = require('../models/workspaceSession.model');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

/**
 * Auto-generate a title from the requirement text
 */
const generateTitle = (requirement) => {
    if (!requirement || !requirement.trim()) return 'Untitled Session';
    // Take first sentence or first 50 chars
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
        const userId = req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const skip = (page - 1) * limit;

        // Build filter
        const filter = { userId };

        // Status filter
        if (req.query.status) {
            filter.status = req.query.status;
        } else {
            // By default, exclude archived
            filter.status = { $ne: 'Archived' };
        }

        // Context filter
        if (req.query.context && ['web', 'mobile', 'api'].includes(req.query.context)) {
            filter.context = req.query.context;
        }

        // Text search
        if (req.query.search && req.query.search.trim()) {
            const searchTerm = req.query.search.trim();
            filter.$or = [
                { title: { $regex: searchTerm, $options: 'i' } },
                { requirement: { $regex: searchTerm, $options: 'i' } }
            ];
        }

        // Build sort
        let sort = { updatedAt: -1 }; // Default: recently updated
        if (req.query.sort === 'createdAt') sort = { createdAt: -1 };
        if (req.query.sort === 'title') sort = { title: 1 };
        if (req.query.sort === 'totalTests') sort = { 'summary.total': -1 };

        const [sessions, total] = await Promise.all([
            WorkspaceSession.find(filter)
                .select('-suiteData -versions -messages') // Exclude heavy fields in list
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            WorkspaceSession.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: sessions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
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
        const userId = req.user._id;
        const { requirement, context, depth, title } = req.body;

        const session = await WorkspaceSession.create({
            userId,
            title: title || generateTitle(requirement),
            requirement: requirement || '',
            context: context || 'web',
            depth: depth || 'Standard',
            status: requirement && requirement.trim() ? 'Draft' : 'Draft',
            messages: requirement && requirement.trim()
                ? [{ role: 'user', content: requirement }]
                : []
        });

        res.status(201).json({
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
 * GET /api/v1/sessions/:id
 */
const getSession = async (req, res) => {
    try {
        const userId = req.user._id;
        const sessionId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return res.status(400).json({ success: false, message: 'Invalid session ID' });
        }

        const session = await WorkspaceSession.findOne({
            _id: sessionId,
            userId: userId
        }).lean();

        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        res.json({ success: true, data: session });
    } catch (error) {
        logger.error('Error getting session', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * UPDATE a session (partial update)
 * PATCH /api/v1/sessions/:id
 */
const updateSession = async (req, res) => {
    try {
        const userId = req.user._id;
        const sessionId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return res.status(400).json({ success: false, message: 'Invalid session ID' });
        }

        // Verify ownership
        const session = await WorkspaceSession.findOne({ _id: sessionId, userId });
        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        // Allowed update fields
        const allowedFields = [
            'title', 'status', 'requirement', 'context', 'depth',
            'messages', 'suiteData', 'summary', 'quality', 'currentVersion'
        ];

        const update = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                update[field] = req.body[field];
            }
        }

        // If pushing a new message instead of replacing all
        if (req.body.pushMessage) {
            const msg = req.body.pushMessage;
            session.messages.push({
                role: msg.role || 'user',
                content: msg.content,
                timestamp: new Date()
            });
            await session.save();
            return res.json({ success: true, data: session });
        }

        // Auto-generate title if requirement changed and title is still default
        if (update.requirement && (session.title === 'Untitled Session' || !session.title)) {
            update.title = generateTitle(update.requirement);
        }

        const updated = await WorkspaceSession.findOneAndUpdate(
            { _id: sessionId, userId },
            { $set: update },
            { new: true, runValidators: true }
        ).lean();

        res.json({ success: true, data: updated });
    } catch (error) {
        logger.error('Error updating session', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * DELETE a session
 * DELETE /api/v1/sessions/:id
 */
const deleteSession = async (req, res) => {
    try {
        const userId = req.user._id;
        const sessionId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return res.status(400).json({ success: false, message: 'Invalid session ID' });
        }

        const result = await WorkspaceSession.findOneAndDelete({ _id: sessionId, userId });

        if (!result) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        res.json({ success: true, message: 'Session deleted' });
    } catch (error) {
        logger.error('Error deleting session', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET version history for a session
 * GET /api/v1/sessions/:id/versions
 */
const getVersions = async (req, res) => {
    try {
        const userId = req.user._id;
        const sessionId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return res.status(400).json({ success: false, message: 'Invalid session ID' });
        }

        const session = await WorkspaceSession.findOne(
            { _id: sessionId, userId },
            { versions: 1, currentVersion: 1 }
        ).lean();

        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        res.json({
            success: true,
            data: {
                currentVersion: session.currentVersion,
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
        const userId = req.user._id;
        const sessionId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return res.status(400).json({ success: false, message: 'Invalid session ID' });
        }

        const session = await WorkspaceSession.findOne({ _id: sessionId, userId });
        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        if (!session.suiteData) {
            return res.status(400).json({ success: false, message: 'No suite data to version' });
        }

        const newVersionNumber = (session.currentVersion || 0) + 1;

        session.versions.push({
            versionNumber: newVersionNumber,
            suiteData: session.suiteData,
            summary: { ...session.summary.toObject ? session.summary.toObject() : session.summary },
            createdAt: new Date()
        });

        session.currentVersion = newVersionNumber;
        await session.save();

        res.status(201).json({
            success: true,
            data: {
                versionNumber: newVersionNumber,
                totalVersions: session.versions.length
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
    createVersion
};
