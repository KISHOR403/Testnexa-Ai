/**
 * TestNexa AI — Test Maintenance Intelligence Controller
 */

const maintenanceIntelligenceService = require('../services/runner/maintenanceIntelligence.service');
const supabaseService = require('../services/supabaseData.service');
const logger = require('../utils/logger');

const resolveWorkspaceId = async (req) => {
    const userId = req.user._id || req.user.id;
    if (req.body?.workspaceId) return req.body.workspaceId;
    if (req.query?.workspaceId) return req.query.workspaceId;
    if (req.params?.workspaceId) return req.params.workspaceId;

    const primary = await supabaseService.getUserPrimaryWorkspace(userId, req.user.name || '');
    return primary ? primary.id : null;
};

const verifyAccess = async (req, res, workspaceId) => {
    const userId = req.user._id || req.user.id;
    if (!workspaceId) {
        res.status(400).json({ success: false, message: 'No workspace context provided' });
        return false;
    }
    const hasAccess = await supabaseService.verifyUserWorkspaceAccess(workspaceId, userId);
    if (!hasAccess) {
        res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: 'You do not have access to this workspace'
        });
        return false;
    }
    return true;
};

/**
 * GET /api/v1/maintenance/overview
 * Scans automation execution records and returns maintenance findings & summary
 */
const getMaintenanceOverview = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Unable to resolve workspace' });
        }
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const options = {
            suiteId: req.query.suiteId || null,
            startDate: req.query.startDate || null,
            endDate: req.query.endDate || null,
            browser: req.query.browser || null,
            environment: req.query.environment || null
        };

        const result = await maintenanceIntelligenceService.scanWorkspaceMaintenance(workspaceId, options);

        // Apply in-memory list filters if requested
        let filteredFindings = result.findings;
        if (req.query.issueType && req.query.issueType !== 'all') {
            filteredFindings = filteredFindings.filter(f => f.issueType.toLowerCase() === req.query.issueType.toLowerCase());
        }
        if (req.query.classification && req.query.classification !== 'all') {
            filteredFindings = filteredFindings.filter(f => f.classification.toLowerCase() === req.query.classification.toLowerCase());
        }
        if (req.query.status && req.query.status !== 'all') {
            filteredFindings = filteredFindings.filter(f => f.status.toLowerCase() === req.query.status.toLowerCase());
        }
        if (req.query.search && req.query.search.trim()) {
            const q = req.query.search.toLowerCase();
            filteredFindings = filteredFindings.filter(f =>
                (f.testCaseTitle || '').toLowerCase().includes(q) ||
                (f.testCaseId || '').toLowerCase().includes(q) ||
                (f.locator || '').toLowerCase().includes(q) ||
                (f.errorMessage || '').toLowerCase().includes(q)
            );
        }

        return res.status(200).json({
            success: true,
            data: {
                summary: result.summary,
                findings: filteredFindings
            }
        });
    } catch (error) {
        logger.error('Error fetching maintenance overview:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch maintenance overview'
        });
    }
};

/**
 * GET /api/v1/maintenance/findings/:id
 * Retrieves single finding details
 */
const getFindingById = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) return res.status(400).json({ success: false, message: 'Unable to resolve workspace' });
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const finding = await maintenanceIntelligenceService.getFindingById(workspaceId, req.params.id);
        if (!finding) {
            return res.status(404).json({ success: false, message: 'Maintenance finding not found' });
        }

        return res.status(200).json({
            success: true,
            data: finding
        });
    } catch (error) {
        logger.error('Error retrieving maintenance finding:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to retrieve finding'
        });
    }
};

/**
 * PATCH /api/v1/maintenance/findings/:id
 * Updates finding status (open, investigating, resolved, ignored) and resolution notes
 */
const updateFinding = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) return res.status(400).json({ success: false, message: 'Unable to resolve workspace' });
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const userId = req.user._id || req.user.id;
        const { status, resolutionNotes } = req.body || {};

        if (status && !['open', 'investigating', 'resolved', 'ignored'].includes(status)) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_STATUS',
                message: 'Status must be one of: open, investigating, resolved, ignored'
            });
        }

        const updated = await maintenanceIntelligenceService.updateFindingStatus(workspaceId, req.params.id, {
            status,
            resolutionNotes,
            userId
        });

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Maintenance finding not found' });
        }

        return res.status(200).json({
            success: true,
            data: updated
        });
    } catch (error) {
        logger.error('Error updating maintenance finding:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to update finding'
        });
    }
};

/**
 * POST /api/v1/maintenance/findings/:id/ai-analyze
 * Analyzes locator or execution failure with AI and suggests resilient selectors
 */
const analyzeFindingWithAI = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) return res.status(400).json({ success: false, message: 'Unable to resolve workspace' });
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const userId = req.user._id || req.user.id;
        const updated = await maintenanceIntelligenceService.analyzeFindingWithAI(workspaceId, req.params.id, userId);

        return res.status(200).json({
            success: true,
            data: updated
        });
    } catch (error) {
        logger.error('Error analyzing maintenance finding with AI:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to analyze maintenance finding'
        });
    }
};

module.exports = {
    getMaintenanceOverview,
    getFindingById,
    updateFinding,
    analyzeFindingWithAI
};

