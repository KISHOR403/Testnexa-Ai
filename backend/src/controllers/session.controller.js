const WorkspaceSession = require('../models/workspaceSession.model');
const supabaseService = require('../services/supabaseData.service');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

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

        if (supabaseService.isAvailable) {
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
        }

        // Fallback to MongoDB
        const skip = (page - 1) * limit;
        const filter = { userId };

        if (req.query.status) {
            filter.status = req.query.status;
        } else {
            filter.status = { $ne: 'Archived' };
        }

        if (req.query.context && ['web', 'mobile', 'api'].includes(req.query.context)) {
            filter.context = req.query.context;
        }

        if (req.query.search && req.query.search.trim()) {
            const searchTerm = req.query.search.trim();
            filter.$or = [
                { title: { $regex: searchTerm, $options: 'i' } },
                { requirement: { $regex: searchTerm, $options: 'i' } }
            ];
        }

        let sort = { updatedAt: -1 };
        if (req.query.sort === 'createdAt') sort = { createdAt: -1 };
        if (req.query.sort === 'title') sort = { title: 1 };
        if (req.query.sort === 'totalTests') sort = { 'summary.total': -1 };

        const [sessions, total] = await Promise.all([
            WorkspaceSession.find(filter)
                .select('-suiteData -versions -messages')
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
        const userId = req.user._id || req.user.id;
        const { requirement, context, depth, title } = req.body;

        if (supabaseService.isAvailable) {
            const session = await supabaseService.createSession({
                userId,
                title: title || generateTitle(requirement),
                requirement: requirement || '',
                context: context || 'web',
                depth: depth || 'Standard',
                status: 'Draft',
                messages: requirement && requirement.trim()
                    ? [{ role: 'user', content: requirement, timestamp: new Date().toISOString() }]
                    : []
            });

            return res.status(201).json({
                success: true,
                data: session
            });
        }

        // Fallback to MongoDB
        const session = await WorkspaceSession.create({
            userId,
            title: title || generateTitle(requirement),
            requirement: requirement || '',
            context: context || 'web',
            depth: depth || 'Standard',
            status: 'Draft',
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
        const userId = req.user._id || req.user.id;
        const sessionId = req.params.id;

        if (supabaseService.isAvailable) {
            const session = await supabaseService.getSession(sessionId, userId);
            if (!session) {
                return res.status(404).json({ success: false, message: 'Session not found' });
            }
            return res.json({ success: true, data: session });
        }

        // Fallback to MongoDB
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
        const userId = req.user._id || req.user.id;
        const sessionId = req.params.id;

        if (supabaseService.isAvailable) {
            const existing = await supabaseService.getSession(sessionId, userId);
            if (!existing) {
                return res.status(404).json({ success: false, message: 'Session not found' });
            }

            // If pushing a single message
            if (req.body.pushMessage) {
                const msg = req.body.pushMessage;
                const messages = [...(existing.messages || []), {
                    role: msg.role || 'user',
                    content: msg.content,
                    timestamp: new Date().toISOString()
                }];
                const updated = await supabaseService.updateSession(sessionId, userId, { messages });
                return res.json({ success: true, data: updated });
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

            if (updates.requirement && (existing.title === 'Untitled Session' || !existing.title)) {
                updates.title = generateTitle(updates.requirement);
            }

            const updated = await supabaseService.updateSession(sessionId, userId, updates);
            return res.json({ success: true, data: updated });
        }

        // Fallback to MongoDB
        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return res.status(400).json({ success: false, message: 'Invalid session ID' });
        }

        const session = await WorkspaceSession.findOne({ _id: sessionId, userId });
        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

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
        const userId = req.user._id || req.user.id;
        const sessionId = req.params.id;

        if (supabaseService.isAvailable) {
            await supabaseService.deleteSession(sessionId, userId);
            return res.json({ success: true, message: 'Session deleted' });
        }

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
        const userId = req.user._id || req.user.id;
        const sessionId = req.params.id;

        if (supabaseService.isAvailable) {
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
        }

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
        const userId = req.user._id || req.user.id;
        const sessionId = req.params.id;

        if (supabaseService.isAvailable) {
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
        }

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
