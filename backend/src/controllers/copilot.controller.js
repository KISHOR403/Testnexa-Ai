const copilotService = require('../services/copilot.service');
const logger = require('../utils/logger');
const {
    contextQuerySchema,
    chatBodySchema,
    feedbackBodySchema
} = require('../utils/copilot.validation');

/**
 * GET /api/v1/copilot/context
 * Server-side contextual data builder (Single source of truth)
 */
const getContext = async (req, res) => {
    try {
        const { error, value } = contextQuerySchema.validate(req.query);
        if (error) {
            return res.status(400).json({
                code: 'INVALID_QUERY',
                message: error.details[0]?.message || 'Invalid query parameters'
            });
        }

        const userId = req.user?._id || req.user?.id;
        const result = await copilotService.buildAuthoritativeContext({
            suiteId: value.suite_id,
            caseId: value.case_id,
            requirementId: value.requirement_id,
            page: value.page,
            userId
        });

        if (result.notFound) {
            return res.status(404).json({
                code: 'NOT_FOUND',
                message: result.message || 'Requested test suite resource not found'
            });
        }

        return res.json(result);
    } catch (err) {
        logger.error('Error in Copilot getContext:', err);
        return res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Unable to build Copilot context'
        });
    }
};

/**
 * POST /api/v1/copilot/chat
 * Stateless streaming assistant endpoint using Server-Sent Events (SSE)
 */
const chat = async (req, res) => {
    try {
        const { error, value } = chatBodySchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                code: 'INVALID_BODY',
                message: error.details[0]?.message || 'Invalid request body'
            });
        }

        const userId = req.user?._id || req.user?.id;
        await copilotService.streamChat({
            res,
            req,
            messages: value.messages,
            page: value.page,
            suiteId: value.suite_id,
            caseId: value.case_id,
            requirementId: value.requirement_id,
            draftText: value.draftText,
            userId
        });
    } catch (err) {
        logger.error('Error in Copilot chat:', err);
        if (!res.headersSent) {
            return res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'Failed to initiate Copilot stream'
            });
        }
    }
};

/**
 * POST /api/v1/copilot/feedback
 * Records user rating without storing message or prompt text
 */
const recordFeedback = async (req, res) => {
    try {
        const { error, value } = feedbackBodySchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                code: 'INVALID_BODY',
                message: error.details[0]?.message || 'Invalid feedback data'
            });
        }

        const userId = req.user?._id || req.user?.id;
        const result = await copilotService.recordFeedback({
            rating: value.rating,
            reason: value.reason,
            page: value.page,
            userId
        });

        return res.json(result);
    } catch (err) {
        logger.error('Error in Copilot recordFeedback:', err);
        return res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Failed to record feedback'
        });
    }
};

/**
 * GET /api/v1/copilot/feedback/summary
 * Admin-only metrics summary of Copilot ratings
 */
const getFeedbackSummary = async (req, res) => {
    try {
        const userRole = req.user?.role || 'user';
        if (!['admin', 'owner'].includes(userRole)) {
            return res.status(403).json({
                code: 'FORBIDDEN',
                message: 'Admin access required to view feedback analytics'
            });
        }

        const summary = await copilotService.getFeedbackSummary();
        return res.json({
            success: true,
            data: summary
        });
    } catch (err) {
        logger.error('Error in Copilot getFeedbackSummary:', err);
        return res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Failed to retrieve feedback summary'
        });
    }
};

/**
 * Legacy compatibility: GET /api/v1/copilot/context/:testSuiteId
 */
const getSuiteContext = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const result = await copilotService.buildAuthoritativeContext({
            suiteId: req.params.testSuiteId,
            userId
        });

        if (result.notFound) {
            return res.status(404).json({
                code: 'NOT_FOUND',
                message: 'Test suite not found or access denied.'
            });
        }

        return res.json({
            success: true,
            data: {
                id: result.scope?.id,
                title: result.facts?.suite?.name,
                totalTests: result.facts?.suite?.cases,
                status: 'Needs Review',
                summary: { total: result.facts?.suite?.cases },
                quality: { coverageConfidence: result.facts?.suite?.linkedPct },
                testCaseIds: (result.facts?.suite?.caseList || []).map(t => ({ id: t.id, title: t.title, type: t.type }))
            }
        });
    } catch (err) {
        logger.error('Error in legacy getSuiteContext:', err);
        return res.status(500).json({
            code: 'GET_CONTEXT_FAILED',
            message: 'Unable to retrieve test suite context.'
        });
    }
};

module.exports = {
    getContext,
    chat,
    recordFeedback,
    getFeedbackSummary,
    getSuiteContext
};
