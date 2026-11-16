const Joi = require('joi');
const intelligenceService = require('../services/intelligence.service');
const logger = require('../utils/logger');

const overviewQuerySchema = Joi.object({
    suite_id: Joi.string().trim().max(100).default('all'),
    suiteId: Joi.string().trim().max(100)
}).unknown(true);

const activityQuerySchema = Joi.object({
    suite_id: Joi.string().trim().max(100).default('all'),
    suiteId: Joi.string().trim().max(100),
    days: Joi.number().integer().min(1).max(365).default(30),
    tz: Joi.string().trim().max(50).default('UTC')
}).unknown(true);

/**
 * GET /api/v1/intelligence/overview
 * Returns authoring, review, canonical traceability, and gap metrics
 */
const getOverview = async (req, res) => {
    try {
        const { error, value } = overviewQuerySchema.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const suiteId = value.suite_id || value.suiteId || 'all';
        const userId = req.user?._id || req.user?.id;

        const overview = await intelligenceService.getIntelligenceOverview(suiteId, userId);

        return res.json({
            success: true,
            data: overview
        });
    } catch (err) {
        logger.error('Error in getOverview:', err);
        return res.status(500).json({
            success: false,
            message: err.message || 'Failed to retrieve intelligence overview'
        });
    }
};

/**
 * GET /api/v1/intelligence/activity
 * Returns timezone-adjusted daily activity buckets and period totals from case_events
 */
const getActivity = async (req, res) => {
    try {
        const { error, value } = activityQuerySchema.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const suiteId = value.suite_id || value.suiteId || 'all';
        const days = value.days || 30;
        const tz = value.tz || 'UTC';
        const userId = req.user?._id || req.user?.id;

        const activityData = await intelligenceService.getIntelligenceActivity({
            suiteId,
            userId,
            days,
            tz
        });

        return res.json({
            success: true,
            data: activityData
        });
    } catch (err) {
        logger.error('Error in getActivity:', err);
        return res.status(500).json({
            success: false,
            message: err.message || 'Failed to retrieve intelligence activity'
        });
    }
};

module.exports = {
    getOverview,
    getActivity
};
