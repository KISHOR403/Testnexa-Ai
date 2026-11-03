/**
 * TestNexa AI — Smart Test Recommendations Controller
 */

const smartRecommendationsService = require('../services/recommendations/smartRecommendations.service');
const supabaseService = require('../services/supabaseData.service');
const logger = require('../utils/logger');

/**
 * POST /api/v1/recommendations/generate
 * Analyzes requirements and existing test cases, then generates smart recommendations
 */
const generateRecommendations = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const {
            suiteId,
            requirementId,
            requestedCategories,
            focusArea,
            limit
        } = req.body || {};

        if (!suiteId) {
            return res.status(400).json({
                success: false,
                code: 'MISSING_PARAM',
                message: 'suiteId is required'
            });
        }

        const result = await smartRecommendationsService.generateRecommendations({
            suiteId,
            userId,
            requirementId: requirementId || null,
            requestedCategories: Array.isArray(requestedCategories) ? requestedCategories : null,
            focusArea: focusArea || null,
            limit: limit ? parseInt(limit, 10) : 6
        });

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Error generating recommendations:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            code: error.code || 'RECOMMENDATION_ERROR',
            message: error.message || 'Failed to generate recommendations'
        });
    }
};

/**
 * GET /api/v1/recommendations/suites/:suiteId
 * Retrieves the latest recommendations for a test suite
 */
const getSuiteRecommendations = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { suiteId } = req.params;

        if (!suiteId) {
            return res.status(400).json({ success: false, message: 'suiteId is required' });
        }

        const session = await supabaseService.getRecommendationSessionBySuite(suiteId, userId);

        return res.status(200).json({
            success: true,
            data: session || null
        });
    } catch (error) {
        logger.error('Error retrieving suite recommendations:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to retrieve recommendations'
        });
    }
};

/**
 * GET /api/v1/recommendations/:id
 * Retrieves a single recommendation by ID
 */
const getRecommendationById = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { id } = req.params;

        const rec = await supabaseService.getRecommendation(id, userId);
        if (!rec) {
            return res.status(404).json({ success: false, message: 'Recommendation not found' });
        }

        return res.status(200).json({
            success: true,
            data: rec
        });
    } catch (error) {
        logger.error('Error retrieving recommendation:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to retrieve recommendation'
        });
    }
};

/**
 * PATCH /api/v1/recommendations/:id
 * Updates recommendation status (accepted, rejected, pending) or edits content
 */
const updateRecommendation = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { id } = req.params;
        const { status, editedFields } = req.body || {};

        if (status && !['pending', 'accepted', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_STATUS',
                message: 'Status must be one of: pending, accepted, rejected'
            });
        }

        const updated = await smartRecommendationsService.updateRecommendationStatus(id, userId, {
            status,
            editedFields
        });

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Recommendation not found' });
        }

        return res.status(200).json({
            success: true,
            data: updated
        });
    } catch (error) {
        logger.error('Error updating recommendation:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to update recommendation'
        });
    }
};

/**
 * POST /api/v1/recommendations/convert-to-drafts
 * Converts accepted recommendations into draft test cases in the test suite
 */
const convertToDrafts = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { suiteId, recommendationIds } = req.body || {};

        if (!suiteId || !Array.isArray(recommendationIds) || recommendationIds.length === 0) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_REQUEST',
                message: 'suiteId and an array of recommendationIds are required'
            });
        }

        const result = await smartRecommendationsService.convertRecommendationsToDraftCases({
            suiteId,
            userId,
            recommendationIds
        });

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Error converting recommendations to draft cases:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            code: error.code || 'CONVERSION_ERROR',
            message: error.message || 'Failed to convert recommendations to draft test cases'
        });
    }
};

module.exports = {
    generateRecommendations,
    getSuiteRecommendations,
    getRecommendationById,
    updateRecommendation,
    convertToDrafts
};
