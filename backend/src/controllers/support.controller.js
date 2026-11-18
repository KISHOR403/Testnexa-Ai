/**
 * Testnexa AI — Support & Help Center Controller
 * Enforces Joi validation schemas, same-origin path security,
 * honeypot interception, and admin analytics queries.
 */

const Joi = require('joi');
const supportService = require('../services/support.service');
const logger = require('../utils/logger');

// Custom validator to ensure page_url is strictly a same-origin path
const sameOriginPathValidator = (value, helpers) => {
    if (!value) return value;
    const trimmed = String(value).trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('://')) {
        return helpers.error('any.invalid');
    }
    return trimmed;
};

// Joi Schemas
const supportRequestSchema = Joi.object({
    topic: Joi.string().valid(
        'account',
        'generation',
        'traceability_coverage',
        'export',
        'integrations',
        'billing',
        'bug',
        'other'
    ).required().messages({
        'any.required': 'Topic is required',
        'any.only': 'Invalid support topic selected'
    }),
    message: Joi.string().min(20).max(4000).required().messages({
        'string.min': 'Message must be at least 20 characters long',
        'string.max': 'Message cannot exceed 4000 characters',
        'any.required': 'Message is required'
    }),
    email: Joi.string().email().max(254).optional().messages({
        'string.email': 'Please provide a valid email address'
    }),
    page_url: Joi.string().max(2000).optional().allow('', null).custom(sameOriginPathValidator).messages({
        'any.invalid': 'Page URL must be a valid relative path (e.g. /help or /app/workspace)'
    }),
    app_version: Joi.string().max(50).optional().allow('', null),
    consent: Joi.boolean().valid(true).required().messages({
        'any.only': 'You must consent to be contacted regarding your request',
        'any.required': 'Consent is required'
    }),
    // Spam protection fields
    website: Joi.string().allow('', null).optional(),
    client_timestamp: Joi.number().optional(),
    captcha_token: Joi.string().allow('', null).optional()
});

const feedbackSchema = Joi.object({
    article_slug: Joi.string()
        .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .max(100)
        .required()
        .messages({
            'string.pattern.base': 'Article slug must be lowercase alphanumeric with hyphens',
            'any.required': 'Article slug is required'
        }),
    helpful: Joi.boolean().required().messages({
        'any.required': 'Helpful boolean is required'
    }),
    comment: Joi.string().max(500).allow('', null).optional().messages({
        'string.max': 'Comment cannot exceed 500 characters'
    })
});

const searchMissSchema = Joi.object({
    query: Joi.string().min(1).max(100).required().messages({
        'any.required': 'Search query is required',
        'string.max': 'Query cannot exceed 100 characters'
    })
});

/**
 * POST /api/v1/support/requests
 * Works signed-in or anonymous
 */
exports.submitSupportRequest = async (req, res) => {
    try {
        const { error, value } = supportRequestSchema.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: error.details.map(d => d.message).join('; '),
                details: error.details
            });
        }

        // Email resolution: required if anonymous; defaults to user.email if authenticated
        let senderEmail = value.email;
        if (!senderEmail && req.user?.email) {
            senderEmail = req.user.email;
        }

        if (!senderEmail) {
            return res.status(400).json({
                success: false,
                code: 'EMAIL_REQUIRED',
                message: 'Email is required for anonymous support requests'
            });
        }

        const userId = req.user?.id || req.user?._id || null;
        const remoteIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || '';

        const result = await supportService.createSupportRequest({
            topic: value.topic,
            message: value.message,
            email: senderEmail,
            pageUrl: value.page_url,
            appVersion: value.app_version,
            userId,
            website: value.website,
            clientTimestamp: value.client_timestamp,
            captchaToken: value.captcha_token,
            remoteIp
        });

        return res.status(201).json({
            success: true,
            data: result
        });
    } catch (err) {
        if (err.status && err.status < 500) {
            return res.status(err.status).json({
                success: false,
                code: err.code || 'BAD_REQUEST',
                message: err.message
            });
        }
        logger.error('Failed to submit support request:', err);
        return res.status(500).json({
            success: false,
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred while processing your support request.'
        });
    }
};

/**
 * POST /api/v1/help/feedback
 */
exports.submitArticleFeedback = async (req, res) => {
    try {
        const { error, value } = feedbackSchema.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: error.details.map(d => d.message).join('; ')
            });
        }

        const userId = req.user?.id || req.user?._id || null;
        const remoteIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || '';

        const result = await supportService.recordArticleFeedback({
            articleSlug: value.article_slug,
            helpful: value.helpful,
            comment: value.comment,
            ip: remoteIp,
            userId
        });

        return res.status(201).json({
            success: true,
            message: 'Thank you for your feedback.',
            id: result.id
        });
    } catch (err) {
        logger.error('Failed to record article feedback:', err);
        return res.status(500).json({
            success: false,
            code: 'INTERNAL_ERROR',
            message: 'Failed to record feedback'
        });
    }
};

/**
 * POST /api/v1/help/search-misses
 */
exports.submitSearchMiss = async (req, res) => {
    try {
        const { error, value } = searchMissSchema.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: error.details.map(d => d.message).join('; ')
            });
        }

        const result = await supportService.recordSearchMiss(value.query);

        return res.status(200).json({
            success: true,
            data: { query: result.query }
        });
    } catch (err) {
        if (err.status && err.status < 500) {
            return res.status(err.status).json({
                success: false,
                code: err.code || 'BAD_REQUEST',
                message: err.message
            });
        }
        logger.error('Failed to record search miss:', err);
        return res.status(500).json({
            success: false,
            code: 'INTERNAL_ERROR',
            message: 'Failed to record search query'
        });
    }
};

/**
 * GET /api/v1/help/admin-summary
 * Requires Admin Role
 */
exports.getAdminSummary = async (req, res) => {
    try {
        const summary = await supportService.getHelpAdminSummary();
        return res.status(200).json({
            success: true,
            data: summary
        });
    } catch (err) {
        logger.error('Failed to fetch help admin summary:', err);
        return res.status(500).json({
            success: false,
            code: 'INTERNAL_ERROR',
            message: 'Failed to retrieve admin summary'
        });
    }
};
