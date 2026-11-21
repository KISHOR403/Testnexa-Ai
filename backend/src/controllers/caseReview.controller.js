/**
 * Testnexa AI — Case Review & Requirements Controller
 * Handlers for approvals, versioned edits, AI regeneration, and requirement links.
 */

const caseReviewService = require('../services/caseReview.service');
const logger = require('../utils/logger');
const {
    approvalSchema,
    approveRemainingSchema,
    undoApprovalSchema,
    caseEditSchema,
    regeneratePreviewSchema,
    regenerateApplySchema,
    requirementCreateSchema,
    requirementUpdateSchema,
    linkRequirementSchema
} = require('../utils/caseReview.validation');

// Rate limiting & body size validation helpers
const MAX_BODY_BYTES = 50 * 1024; // 50 KB

function checkBodySize(req, res) {
    if (req.rawBody && req.rawBody.length > MAX_BODY_BYTES) {
        res.status(413).json({
            success: false,
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Request body exceeds maximum allowed size of 50 KB.'
        });
        return false;
    }
    return true;
}

/**
 * PATCH /api/v1/cases/:id/approval
 * Action: 'approve' | 'reject' | 'reset'
 */
exports.updateApproval = async (req, res) => {
    try {
        if (!checkBodySize(req, res)) return;
        const { id } = req.params;
        const { error, value } = approvalSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: error.details[0].message
            });
        }

        const result = await caseReviewService.updateCaseApproval({
            caseId: id,
            action: value.action,
            version: value.version,
            reason: value.reason,
            user: req.user
        });

        return res.status(200).json(result);
    } catch (err) {
        const status = err.statusCode || 500;
        const code = err.code || 'SERVER_ERROR';
        const payload = { success: false, code, message: err.message };
        if (err.currentCase) payload.currentCase = err.currentCase;
        return res.status(status).json(payload);
    }
};

/**
 * POST /api/v1/suites/:id/approve-remaining
 */
exports.approveRemaining = async (req, res) => {
    try {
        if (!checkBodySize(req, res)) return;
        const { id } = req.params;
        const idempotencyKey = req.headers?.['idempotency-key'] || req.headers?.['x-idempotency-key'];
        const { error, value } = approveRemainingSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: error.details[0].message
            });
        }

        const result = await caseReviewService.approveRemaining({
            suiteId: id,
            caseIds: value.caseIds,
            expectedCount: value.expectedCount,
            idempotencyKey,
            user: req.user
        });

        return res.status(200).json(result);
    } catch (err) {
        const status = err.statusCode || 500;
        const code = err.code || 'SERVER_ERROR';
        const payload = { success: false, code, message: err.message };
        if (err.currentPendingCount !== undefined) payload.currentPendingCount = err.currentPendingCount;
        return res.status(status).json(payload);
    }
};

/**
 * POST /api/v1/approvals/undo
 */
exports.undoApproval = async (req, res) => {
    try {
        if (!checkBodySize(req, res)) return;
        const { error, value } = undoApprovalSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: error.details[0].message
            });
        }

        const result = await caseReviewService.undoApproval({
            batchId: value.batchId,
            caseIds: value.caseIds,
            user: req.user
        });

        return res.status(200).json(result);
    } catch (err) {
        const status = err.statusCode || 500;
        return res.status(status).json({ success: false, code: err.code || 'SERVER_ERROR', message: err.message });
    }
};

/**
 * PUT /api/v1/cases/:id
 * Versioned test case edit with optimistic concurrency (If-Match or body.version)
 */
exports.editCase = async (req, res) => {
    try {
        if (!checkBodySize(req, res)) return;
        const { id } = req.params;
        const ifMatch = req.headers?.['if-match'];

        const result = await caseReviewService.editTestCase({
            caseId: id,
            ifMatchVersion: ifMatch,
            payload: req.body,
            user: req.user
        });

        return res.status(200).json(result);
    } catch (err) {
        const status = err.statusCode || 500;
        const code = err.code || 'SERVER_ERROR';
        const payload = { success: false, code, message: err.message };
        if (err.currentCase) payload.currentCase = err.currentCase;
        return res.status(status).json(payload);
    }
};

/**
 * GET /api/v1/cases/:id/versions
 */
exports.getVersions = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await caseReviewService.getCaseVersions(id, req.user);
        return res.status(200).json(result);
    } catch (err) {
        const status = err.statusCode || 500;
        return res.status(status).json({ success: false, code: err.code || 'SERVER_ERROR', message: err.message });
    }
};

/**
 * POST /api/v1/cases/:id/versions/:v/restore
 */
exports.restoreVersion = async (req, res) => {
    try {
        const { id, v } = req.params;
        const result = await caseReviewService.restoreCaseVersion({
            caseId: id,
            targetVersion: v,
            user: req.user
        });
        return res.status(200).json(result);
    } catch (err) {
        const status = err.statusCode || 500;
        return res.status(status).json({ success: false, code: err.code || 'SERVER_ERROR', message: err.message });
    }
};

/**
 * POST /api/v1/cases/:id/regenerate/preview
 */
exports.previewRegenerate = async (req, res) => {
    try {
        if (!checkBodySize(req, res)) return;
        const { id } = req.params;
        const { error, value } = regeneratePreviewSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: error.details[0].message });
        }

        // Support client cancellation
        const controller = new AbortController();
        if (typeof req.on === 'function') {
            req.on('close', () => {
                if (!res.writableEnded) {
                    controller.abort();
                }
            });
        }

        // 30s timeout
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const result = await caseReviewService.previewRegenerateCase({
                caseId: id,
                instruction: value?.instruction,
                user: req.user,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return res.status(200).json(result);
        } catch (innerErr) {
            clearTimeout(timeoutId);
            throw innerErr;
        }
    } catch (err) {
        const status = err.statusCode || 500;
        if (err.retryAfter) {
            res.setHeader('Retry-After', err.retryAfter);
        }
        return res.status(status).json({
            success: false,
            code: err.code || 'SERVER_ERROR',
            message: err.message,
            retryAfter: err.retryAfter || null
        });
    }
};

/**
 * POST /api/v1/cases/:id/regenerate/apply
 */
exports.applyRegenerate = async (req, res) => {
    try {
        if (!checkBodySize(req, res)) return;
        const { id } = req.params;
        const idempotencyKey = req.headers?.['idempotency-key'] || req.headers?.['x-idempotency-key'];
        const { error, value } = regenerateApplySchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: error.details[0].message });
        }

        const result = await caseReviewService.applyRegenerateCase({
            caseId: id,
            version: value.version,
            proposal: value.proposal,
            idempotencyKey,
            user: req.user
        });

        return res.status(200).json(result);
    } catch (err) {
        const status = err.statusCode || 500;
        const code = err.code || 'SERVER_ERROR';
        const payload = { success: false, code, message: err.message };
        if (err.currentCase) payload.currentCase = err.currentCase;
        return res.status(status).json(payload);
    }
};

/**
 * GET /api/v1/suites/:id/requirements
 */
exports.getSuiteRequirements = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user ? (req.user._id || req.user.id) : null;
        const result = await caseReviewService.getSuiteRequirements(id, userId);
        return res.status(200).json(result);
    } catch (err) {
        const status = err.statusCode || 500;
        return res.status(status).json({ success: false, code: err.code || 'SERVER_ERROR', message: err.message });
    }
};

/**
 * GET /api/v1/requirements/:id
 */
exports.getRequirement = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user ? (req.user._id || req.user.id) : null;
        const result = await caseReviewService.getRequirementById(id, userId);
        return res.status(200).json(result);
    } catch (err) {
        const status = err.statusCode || 500;
        return res.status(status).json({ success: false, code: err.code || 'SERVER_ERROR', message: err.message });
    }
};

/**
 * POST /api/v1/requirements
 */
exports.createRequirement = async (req, res) => {
    try {
        if (!checkBodySize(req, res)) return;
        const { error, value } = requirementCreateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: error.details[0].message });
        }

        const result = await caseReviewService.createRequirement({
            suiteId: value.suiteId,
            title: value.title,
            description: value.description,
            priority: value.priority,
            source_quote: value.source_quote,
            user: req.user
        });

        return res.status(201).json(result);
    } catch (err) {
        const status = err.statusCode || 500;
        return res.status(status).json({ success: false, code: err.code || 'SERVER_ERROR', message: err.message });
    }
};

/**
 * PATCH /api/v1/requirements/:id
 */
exports.updateRequirement = async (req, res) => {
    try {
        if (!checkBodySize(req, res)) return;
        const { id } = req.params;
        const { error, value } = requirementUpdateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: error.details[0].message });
        }

        const result = await caseReviewService.updateRequirement({
            reqId: id,
            version: value.version,
            updates: value,
            user: req.user
        });

        return res.status(200).json(result);
    } catch (err) {
        const status = err.statusCode || 500;
        return res.status(status).json({ success: false, code: err.code || 'SERVER_ERROR', message: err.message });
    }
};

/**
 * DELETE /api/v1/requirements/:id
 */
exports.deleteRequirement = async (req, res) => {
    try {
        const { id } = req.params;
        const force = req.query?.force === 'true' || req.body?.force === true;
        const result = await caseReviewService.deleteRequirement({
            reqId: id,
            force,
            user: req.user
        });
        return res.status(200).json(result);
    } catch (err) {
        const status = err.statusCode || 500;
        const payload = { success: false, code: err.code || 'SERVER_ERROR', message: err.message };
        if (err.linkedCount !== undefined) payload.linkedCount = err.linkedCount;
        return res.status(status).json(payload);
    }
};

/**
 * POST /api/v1/requirements/:id/tests
 */
exports.linkRequirementCase = async (req, res) => {
    try {
        if (!checkBodySize(req, res)) return;
        const { id } = req.params;
        const { error, value } = linkRequirementSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: error.details[0].message });
        }

        const result = await caseReviewService.linkRequirementCase({
            reqId: id,
            caseId: value.caseId,
            rationale: value.rationale,
            user: req.user
        });

        return res.status(201).json(result);
    } catch (err) {
        const status = err.statusCode || 500;
        return res.status(status).json({ success: false, code: err.code || 'SERVER_ERROR', message: err.message });
    }
};

/**
 * DELETE /api/v1/requirements/:id/tests/:caseId
 */
exports.unlinkRequirementCase = async (req, res) => {
    try {
        const { id, caseId } = req.params;
        const confirmUnlinked = req.query?.confirmUnlinked === 'true' || req.body?.confirmUnlinked === true;

        const result = await caseReviewService.unlinkRequirementCase({
            reqId: id,
            caseId,
            confirmUnlinked,
            user: req.user
        });

        return res.status(200).json(result);
    } catch (err) {
        const status = err.statusCode || 500;
        return res.status(status).json({ success: false, code: err.code || 'SERVER_ERROR', message: err.message });
    }
};
