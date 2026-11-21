/**
 * Case Review, Edit & Requirements Validation Schemas
 * Joi validators, text sanitizers, HTML rejection, and credential detection warnings.
 */

const Joi = require('joi');

const CANONICAL_TYPES = ['functional', 'negative', 'edge', 'non_functional', 'security', 'api'];
const SEVERITY_ALLOWLIST = ['Critical', 'Major', 'Minor', 'Trivial'];
const PRIORITY_ALLOWLIST = ['high', 'medium', 'low'];

/**
 * Strips control characters except standard whitespace (newlines, tabs)
 */
function stripControlChars(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, '');
}

/**
 * Checks for presence of HTML tags
 */
function containsHtml(str) {
    if (typeof str !== 'string') return false;
    return /<[a-z/][\s\S]*>/i.test(str);
}

/**
 * Scans text content for realistic or leaked credentials, tokens, or hashes
 * Returns an array of human-readable warnings
 */
function detectCredentialWarnings(obj) {
    const warnings = [];
    const textPieces = [];

    function collectText(val, path = '') {
        if (!val) return;
        if (typeof val === 'string') {
            textPieces.push({ text: val, path });
        } else if (Array.isArray(val)) {
            val.forEach((item, idx) => collectText(item, `${path}[${idx}]`));
        } else if (typeof val === 'object') {
            Object.entries(val).forEach(([k, v]) => collectText(v, path ? `${path}.${k}` : k));
        }
    }

    collectText(obj);

    const patterns = [
        { regex: /password\s*[:=]\s*['"]?[^'"\s]{4,}['"]?/i, label: 'Password pattern detected (e.g., password=...)' },
        { regex: /(?:bearer\s+[a-zA-Z0-9_\-\.]{20,}|(?:api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"]?[a-zA-Z0-9_\-\.]{16,}['"]?)/i, label: 'API key or access token pattern detected' },
        { regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, label: 'JWT token pattern detected' },
        { regex: /\b[a-fA-F0-9]{32,64}\b/, label: 'Suspicious 32+ character hex string detected (possible secret or raw hash)' },
        { regex: /\b(?:[A-Za-z0-9+/]{4}){8,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?\b/, label: 'Suspicious base64-encoded credential or secret detected' }
    ];

    for (const { text, path } of textPieces) {
        for (const p of patterns) {
            if (p.regex.test(text)) {
                const msg = `${p.label} in ${path || 'field'}.`;
                if (!warnings.includes(msg)) warnings.push(msg);
            }
        }
    }

    return warnings;
}

/**
 * Recursive custom sanitizer that strips control chars and checks for HTML
 */
function sanitizeAndValidateStrings(value, helpers) {
    if (typeof value === 'string') {
        if (containsHtml(value)) {
            return helpers.error('custom.containsHtml', { field: helpers.state.path.join('.') });
        }
        return stripControlChars(value);
    }
    return value;
}

// 1. Approval action schema
const approvalSchema = Joi.object({
    action: Joi.string().valid('approve', 'reject', 'reset').required(),
    version: Joi.number().integer().min(1).required(),
    reason: Joi.when('action', {
        is: 'reject',
        then: Joi.string().trim().min(5).max(500).required().messages({
            'string.min': 'Rejection reason must be between 5 and 500 characters',
            'string.max': 'Rejection reason must be between 5 and 500 characters',
            'any.required': 'Rejection reason is required when action is reject'
        }),
        otherwise: Joi.string().trim().max(500).allow('', null).optional()
    })
});

// 2. Approve Remaining schema
const approveRemainingSchema = Joi.object({
    caseIds: Joi.array().items(Joi.string().trim()).min(1).required(),
    expectedCount: Joi.number().integer().min(1).required()
});

// 3. Approvals Undo schema
const undoApprovalSchema = Joi.object({
    batchId: Joi.string().trim().optional(),
    caseIds: Joi.array().items(Joi.string().trim()).min(1).optional()
}).or('batchId', 'caseIds');

// 4. Test Step item schema
const stepItemSchema = Joi.object({
    action: Joi.string().trim().min(1).max(400).required(),
    expected: Joi.string().trim().min(1).max(400).required(),
    data: Joi.string().trim().max(400).allow('', null).optional()
});

// 5. Case Edit / Proposal Schema
const caseEditSchema = Joi.object({
    version: Joi.number().integer().min(1).optional(),
    title: Joi.string().trim().min(5).max(140).required(),
    type: Joi.string().trim().custom((val, helpers) => {
        const norm = String(val || '').toLowerCase().replace(/[\s-]/g, '_');
        if (norm === 'edge_case') return 'edge';
        if (norm === 'nonfunctional') return 'non_functional';
        if (!CANONICAL_TYPES.includes(norm)) {
            return helpers.error('any.invalid');
        }
        return norm;
    }).required(),
    priority: Joi.string().trim().lowercase().valid(...PRIORITY_ALLOWLIST).required(),
    severity: Joi.string().trim().custom((val, helpers) => {
        const found = SEVERITY_ALLOWLIST.find(s => s.toLowerCase() === String(val).toLowerCase());
        if (!found) return helpers.error('any.invalid');
        return found;
    }).required(),
    preconditions: Joi.alternatives().try(
        Joi.array().items(Joi.string().trim().max(300)).max(10),
        Joi.string().trim().max(300)
    ).optional(),
    steps: Joi.array().items(stepItemSchema).min(1).max(30).required(),
    expected: Joi.string().trim().max(600).allow('', null).optional(),
    expectedResult: Joi.string().trim().max(600).allow('', null).optional(),
    tags: Joi.array().items(Joi.string().trim().max(30)).max(10).optional(),
    requirement_ids: Joi.array().items(Joi.string().trim()).max(10).optional(),
    confirmUnlinked: Joi.boolean().optional()
});

// 6. Regenerate Preview schema
const regeneratePreviewSchema = Joi.object({
    instruction: Joi.string().trim().max(200).allow('', null).optional()
});

// 7. Regenerate Apply schema
const regenerateApplySchema = Joi.object({
    version: Joi.number().integer().min(1).required(),
    proposal: caseEditSchema.required()
});

// 8. Manual Requirement Create schema
const requirementCreateSchema = Joi.object({
    suiteId: Joi.string().trim().required(),
    title: Joi.string().trim().min(5).max(200).required(),
    description: Joi.string().trim().max(2000).allow('', null).optional(),
    priority: Joi.string().trim().lowercase().valid(...PRIORITY_ALLOWLIST).default('medium'),
    source_quote: Joi.string().trim().max(2000).allow('', null).optional()
});

// 9. Requirement Update schema
const requirementUpdateSchema = Joi.object({
    version: Joi.number().integer().min(1).optional(),
    title: Joi.string().trim().min(5).max(200).optional(),
    description: Joi.string().trim().max(2000).allow('', null).optional(),
    priority: Joi.string().trim().lowercase().valid(...PRIORITY_ALLOWLIST).optional()
}).min(1);

// 10. Requirement Link schema
const linkRequirementSchema = Joi.object({
    caseId: Joi.string().trim().required(),
    rationale: Joi.string().trim().max(500).allow('', null).optional()
});

module.exports = {
    CANONICAL_TYPES,
    SEVERITY_ALLOWLIST,
    PRIORITY_ALLOWLIST,
    stripControlChars,
    containsHtml,
    detectCredentialWarnings,
    sanitizeAndValidateStrings,
    approvalSchema,
    approveRemainingSchema,
    undoApprovalSchema,
    caseEditSchema,
    regeneratePreviewSchema,
    regenerateApplySchema,
    requirementCreateSchema,
    requirementUpdateSchema,
    linkRequirementSchema
};
