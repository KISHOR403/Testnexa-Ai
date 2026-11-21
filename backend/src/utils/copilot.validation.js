const Joi = require('joi');

const PAGE_TYPES = ['create', 'suite', 'cases', 'traceability', 'risks', 'intelligence', 'recommendations', 'other'];

const ALLOWED_ACTIONS = new Set([
    'open_recommendations',
    'open_case',
    'open_requirement',
    'add_case_draft'
]);

const contextQuerySchema = Joi.object({
    page: Joi.string().valid(...PAGE_TYPES).default('other'),
    suite_id: Joi.string().trim().max(100).allow('', null).optional(),
    case_id: Joi.string().trim().max(100).allow('', null).optional(),
    requirement_id: Joi.string().trim().max(100).allow('', null).optional()
});

const chatMessageSchema = Joi.object({
    role: Joi.string().valid('user', 'assistant').required(),
    content: Joi.string().max(2000).trim().required()
});

const chatBodySchema = Joi.object({
    messages: Joi.array().items(chatMessageSchema).max(12).default([]),
    page: Joi.string().valid(...PAGE_TYPES).default('other'),
    suite_id: Joi.string().trim().max(100).allow('', null).optional(),
    case_id: Joi.string().trim().max(100).allow('', null).optional(),
    requirement_id: Joi.string().trim().max(100).allow('', null).optional(),
    draftText: Joi.string().max(3000).allow('', null).optional()
});

const feedbackBodySchema = Joi.object({
    rating: Joi.string().valid('up', 'down').required(),
    reason: Joi.string().valid('wrong', 'unhelpful', 'unsafe', 'other').optional(),
    page: Joi.string().trim().max(100).default('other')
});

/**
 * Strips dangerous control characters while preserving normal whitespace.
 * Prevents prompt escaping or control injection.
 */
const sanitizeDataText = (text, maxLength = 3000) => {
    if (!text || typeof text !== 'string') return '';
    // Strip control characters (ASCII 0-8, 11-12, 14-31, 127) except tab, newline, cr
    const cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return cleaned.slice(0, maxLength).trim();
};

/**
 * Validates proposed actions against the strict allow-list.
 * Drops anything invalid or outside the schema.
 */
const filterAllowedActions = (actions, availableCaseIds = new Set(), availableReqKeys = new Set()) => {
    if (!Array.isArray(actions)) return [];

    const validated = [];
    for (const act of actions) {
        if (!act || typeof act !== 'object' || !ALLOWED_ACTIONS.has(act.type)) {
            continue;
        }

        if (act.type === 'open_case') {
            const caseId = act.params?.caseId || act.params?.case_id || act.params?.id;
            if (caseId && (availableCaseIds.size === 0 || availableCaseIds.has(String(caseId)))) {
                validated.push({ type: 'open_case', params: { caseId: String(caseId) } });
            }
        } else if (act.type === 'open_requirement') {
            const reqId = act.params?.requirementId || act.params?.requirement_id || act.params?.key || act.params?.id;
            if (reqId && (availableReqKeys.size === 0 || availableReqKeys.has(String(reqId)))) {
                validated.push({ type: 'open_requirement', params: { requirementId: String(reqId) } });
            }
        } else if (act.type === 'open_recommendations') {
            validated.push({ type: 'open_recommendations', params: {} });
        } else if (act.type === 'add_case_draft') {
            const title = sanitizeDataText(act.params?.title || '', 200);
            if (title) {
                validated.push({
                    type: 'add_case_draft',
                    params: {
                        title,
                        type: sanitizeDataText(act.params?.type || 'Functional', 50),
                        priority: sanitizeDataText(act.params?.priority || 'Medium', 20),
                        steps: Array.isArray(act.params?.steps) ? act.params.steps.slice(0, 10).map(s => ({
                            action: sanitizeDataText(s.action || '', 300),
                            expected: sanitizeDataText(s.expected || '', 300)
                        })) : [],
                        expectedResult: sanitizeDataText(act.params?.expectedResult || '', 300)
                    }
                });
            }
        }

        if (validated.length >= 3) break;
    }

    return validated;
};

module.exports = {
    PAGE_TYPES,
    ALLOWED_ACTIONS,
    contextQuerySchema,
    chatBodySchema,
    feedbackBodySchema,
    sanitizeDataText,
    filterAllowedActions
};
