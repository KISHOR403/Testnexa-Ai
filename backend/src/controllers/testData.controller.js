/**
 * TestNexa AI — Test Data Management Controller
 */

const testDataService = require('../services/testData.service');
const supabaseService = require('../services/supabaseData.service');
const logger = require('../utils/logger');

/**
 * Resolves the target workspace ID for the request
 */
const resolveWorkspaceId = async (req) => {
    const userId = req.user?._id || req.user?.id;
    if (req.body?.workspaceId) return req.body.workspaceId;
    if (req.query?.workspaceId) return req.query.workspaceId;
    if (req.params?.workspaceId) return req.params.workspaceId;
    if (req.headers['x-workspace-id']) return req.headers['x-workspace-id'];

    if (!userId) return null;
    const primary = await supabaseService.getUserPrimaryWorkspace(userId, req.user?.name || '');
    return primary ? primary.id : null;
};

/**
 * Verifies that the user has access to the target workspace
 */
const verifyAccess = async (req, res, workspaceId) => {
    const userId = req.user?._id || req.user?.id;
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
 * Validate dataset content syntax and schema
 * POST /api/v1/test-data/validate
 */
exports.validateTestData = async (req, res) => {
    try {
        const { format = 'json', content } = req.body;
        const result = testDataService.validateContent(format, content);
        res.json({
            success: result.valid,
            data: result
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            message: err.message
        });
    }
};

/**
 * List datasets for workspace
 * GET /api/v1/test-data
 */
exports.listDatasets = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const {
            category = 'all',
            format = 'all',
            environment = 'all',
            search = '',
            isArchived = 'false',
            page = 1,
            limit = 50
        } = req.query;

        const result = await testDataService.listDatasets({
            workspaceId,
            category,
            format,
            environment,
            search,
            isArchived,
            page,
            limit
        });

        res.json({
            success: true,
            data: result
        });
    } catch (err) {
        logger.error('Error listing test datasets:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Create a new dataset
 * POST /api/v1/test-data
 */
exports.createDataset = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const userId = req.user?._id || req.user?.id;
        const {
            name,
            description = '',
            category = 'dataset',
            format = 'json',
            content,
            environment = 'All',
            tags = [],
            isSecret = false
        } = req.body;

        const dataset = await testDataService.createDataset({
            workspaceId,
            userId,
            name,
            description,
            category,
            format,
            content,
            environment,
            tags,
            isSecret
        });

        res.status(201).json({
            success: true,
            message: 'Dataset created successfully',
            data: dataset
        });
    } catch (err) {
        if (err.code === 'CONFLICT') {
            return res.status(409).json({ success: false, code: 'CONFLICT', message: err.message });
        }
        if (err.code === 'VALIDATION_ERROR') {
            return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: err.message });
        }
        logger.error('Error creating dataset:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * Get dataset details
 * GET /api/v1/test-data/:id
 */
exports.getDatasetById = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const { id } = req.params;
        const dataset = await testDataService.getDatasetById(id, workspaceId, { includeSecrets: false });
        if (!dataset) {
            return res.status(404).json({ success: false, message: 'Dataset not found' });
        }

        res.json({
            success: true,
            data: dataset
        });
    } catch (err) {
        logger.error('Error getting dataset:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Update dataset
 * PUT /api/v1/test-data/:id
 */
exports.updateDataset = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const userId = req.user?._id || req.user?.id;
        const { id } = req.params;

        const updated = await testDataService.updateDataset(id, workspaceId, userId, req.body);

        res.json({
            success: true,
            message: `Dataset updated to version ${updated.version}`,
            data: updated
        });
    } catch (err) {
        if (err.code === 'NOT_FOUND') {
            return res.status(404).json({ success: false, message: err.message });
        }
        if (err.code === 'CONFLICT') {
            return res.status(409).json({ success: false, code: 'CONFLICT', message: err.message });
        }
        if (err.code === 'VALIDATION_ERROR') {
            return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: err.message });
        }
        logger.error('Error updating dataset:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * Delete or archive dataset
 * DELETE /api/v1/test-data/:id
 */
exports.deleteDataset = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const { id } = req.params;
        const permanent = req.query.permanent === 'true';

        const result = await testDataService.deleteDataset(id, workspaceId, { permanent });

        res.json({
            success: true,
            message: permanent ? 'Dataset permanently deleted' : 'Dataset archived successfully',
            data: result
        });
    } catch (err) {
        if (err.code === 'NOT_FOUND') {
            return res.status(404).json({ success: false, message: err.message });
        }
        logger.error('Error deleting dataset:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Restore an archived dataset
 * POST /api/v1/test-data/:id/restore
 */
exports.restoreDataset = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const { id } = req.params;
        const restored = await testDataService.restoreDataset(id, workspaceId);

        res.json({
            success: true,
            message: 'Dataset restored from archive',
            data: restored
        });
    } catch (err) {
        if (err.code === 'NOT_FOUND') {
            return res.status(404).json({ success: false, message: err.message });
        }
        logger.error('Error restoring dataset:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Duplicate dataset
 * POST /api/v1/test-data/:id/duplicate
 */
exports.duplicateDataset = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const userId = req.user?._id || req.user?.id;
        const { id } = req.params;
        const { name } = req.body;

        const duplicate = await testDataService.duplicateDataset(id, workspaceId, userId, name);

        res.status(201).json({
            success: true,
            message: 'Dataset duplicated successfully',
            data: duplicate
        });
    } catch (err) {
        if (err.code === 'NOT_FOUND') {
            return res.status(404).json({ success: false, message: err.message });
        }
        if (err.code === 'CONFLICT') {
            return res.status(409).json({ success: false, message: err.message });
        }
        logger.error('Error duplicating dataset:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * Associate or disassociate test cases / suites
 * POST /api/v1/test-data/:id/associations
 */
exports.updateAssociations = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const { id } = req.params;
        const { testCases = [], testSuites = [], remove = false } = req.body;

        const updated = await testDataService.updateAssociations(id, workspaceId, {
            testCases,
            testSuites,
            remove
        });

        res.json({
            success: true,
            message: remove ? 'Associations removed' : 'Associations updated',
            data: updated
        });
    } catch (err) {
        if (err.code === 'NOT_FOUND') {
            return res.status(404).json({ success: false, message: err.message });
        }
        logger.error('Error updating dataset associations:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * List dataset versions
 * GET /api/v1/test-data/:id/versions
 */
exports.getDatasetVersions = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const { id } = req.params;
        const versions = await testDataService.getDatasetVersions(id, workspaceId);

        res.json({
            success: true,
            data: versions
        });
    } catch (err) {
        if (err.code === 'NOT_FOUND') {
            return res.status(404).json({ success: false, message: err.message });
        }
        logger.error('Error fetching dataset versions:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Get specific version snapshot
 * GET /api/v1/test-data/:id/versions/:version
 */
exports.getDatasetVersion = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const { id, version } = req.params;
        const snapshot = await testDataService.getDatasetVersion(id, version, workspaceId);

        res.json({
            success: true,
            data: snapshot
        });
    } catch (err) {
        if (err.code === 'NOT_FOUND') {
            return res.status(404).json({ success: false, message: err.message });
        }
        logger.error('Error fetching dataset version:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

