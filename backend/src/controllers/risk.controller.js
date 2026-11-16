/**
 * Risk Vectors & Security Controller
 * Implements user-scoped, Joi-validated REST endpoints for threat modeling and mitigation tracking.
 */

const Joi = require('joi');
const riskService = require('../services/risk.service');
const { RISK_CATEGORIES, RISK_STATUSES } = require('../services/riskScoring');
const logger = require('../utils/logger');

// Validation Schemas
const summaryQuerySchema = Joi.object({
    suite_id: Joi.string().allow('', 'all').default('all')
});

const listQuerySchema = Joi.object({
    suite_id: Joi.string().allow('', 'all').default('all'),
    severity: Joi.string().valid('critical', 'high', 'medium', 'low', 'all', '').optional(),
    category: Joi.string().valid(...RISK_CATEGORIES, 'all', '').optional(),
    status: Joi.string().valid(...RISK_STATUSES, 'all', '').optional(),
    mitigation: Joi.string().valid('unmitigated', 'tests_planned', 'tests_approved', 'verified', 'all', '').optional(),
    source: Joi.string().valid('derived', 'generated', 'manual', 'all', '').optional(),
    q: Joi.string().allow('').optional(),
    sort: Joi.string().valid('score', 'severity', 'updated', 'title').default('score'),
    order: Joi.string().valid('asc', 'desc').default('desc'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50)
});

const createRiskSchema = Joi.object({
    suiteId: Joi.string().required(),
    title: Joi.string().min(3).max(200).required(),
    threat: Joi.string().min(5).max(1000).required(),
    category: Joi.string().valid(...RISK_CATEGORIES).default('other'),
    likelihood: Joi.number().integer().min(1).max(5).default(3),
    impact: Joi.number().integer().min(1).max(5).default(3),
    testCaseIds: Joi.array().items(Joi.string()).optional(),
    requirementIds: Joi.array().items(Joi.string()).optional()
});

const updateStatusSchema = Joi.object({
    status: Joi.string().valid(...RISK_STATUSES).required(),
    acceptedReason: Joi.string().max(500).when('status', {
        is: 'accepted',
        then: Joi.required(),
        otherwise: Joi.optional().allow('', null)
    })
});

const linkTestsSchema = Joi.object({
    testCases: Joi.array().items(
        Joi.alternatives().try(
            Joi.string(),
            Joi.object({
                testCaseId: Joi.string().required(),
                rationale: Joi.string().max(500).optional().allow('', null)
            })
        )
    ).min(1).required()
});

exports.getSummary = async (req, res, next) => {
    try {
        const { error, value } = summaryQuerySchema.validate(req.query);
        if (error) {
            return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: error.details[0].message });
        }

        const userId = req.user._id || req.user.id;
        const summary = await riskService.getSummary({
            userId,
            suiteId: value.suite_id
        });

        logger.info(`Fetched risk summary for user ${userId}`, { total: summary.total });
        res.json({ success: true, data: summary });
    } catch (err) {
        next(err);
    }
};

exports.listRisks = async (req, res, next) => {
    try {
        const { error, value } = listQuerySchema.validate(req.query);
        if (error) {
            return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: error.details[0].message });
        }

        const userId = req.user._id || req.user.id;
        const result = await riskService.listRisks({
            userId,
            suiteId: value.suite_id,
            severity: value.severity,
            category: value.category,
            status: value.status,
            mitigation: value.mitigation,
            source: value.source,
            q: value.q,
            sort: value.sort,
            order: value.order,
            page: value.page,
            limit: value.limit
        });

        logger.info(`Listed risks for user ${userId}`, { count: result.risks.length, total: result.total });
        res.json({
            success: true,
            data: result.risks,
            pagination: {
                total: result.total,
                page: result.page,
                limit: result.limit,
                totalPages: result.totalPages
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.getMatrix = async (req, res, next) => {
    try {
        const { error, value } = summaryQuerySchema.validate(req.query);
        if (error) {
            return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: error.details[0].message });
        }

        const userId = req.user._id || req.user.id;
        const matrix = await riskService.getMatrix({
            userId,
            suiteId: value.suite_id
        });

        res.json({ success: true, data: matrix });
    } catch (err) {
        next(err);
    }
};

exports.getRiskById = async (req, res, next) => {
    try {
        const userId = req.user._id || req.user.id;
        const risk = await riskService.getRiskById(req.params.id, userId);

        if (!risk) {
            return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Risk vector not found or access denied' });
        }

        res.json({ success: true, data: risk });
    } catch (err) {
        next(err);
    }
};

exports.createRisk = async (req, res, next) => {
    try {
        const { error, value } = createRiskSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: error.details[0].message });
        }

        const userId = req.user._id || req.user.id;
        const risk = await riskService.createManualRisk(userId, value);

        logger.info(`Created manual risk vector ${risk.id} for user ${userId}`);
        res.status(201).json({ success: true, data: risk });
    } catch (err) {
        next(err);
    }
};

exports.updateStatus = async (req, res, next) => {
    try {
        const { error, value } = updateStatusSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: error.details[0].message });
        }

        const userId = req.user._id || req.user.id;
        const risk = await riskService.updateStatus(req.params.id, userId, {
            status: value.status,
            acceptedReason: value.acceptedReason
        });

        if (!risk) {
            return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Risk vector not found or access denied' });
        }

        logger.info(`Updated status for risk ${req.params.id} to ${value.status} by user ${userId}`);
        res.json({ success: true, data: risk });
    } catch (err) {
        next(err);
    }
};

exports.linkTests = async (req, res, next) => {
    try {
        const { error, value } = linkTestsSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: error.details[0].message });
        }

        const userId = req.user._id || req.user.id;
        const risk = await riskService.linkTests(req.params.id, userId, value.testCases);

        if (!risk) {
            return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Risk vector not found or access denied' });
        }

        logger.info(`Linked ${value.testCases.length} tests to risk ${req.params.id} by user ${userId}`);
        res.json({ success: true, data: risk });
    } catch (err) {
        next(err);
    }
};

exports.unlinkTest = async (req, res, next) => {
    try {
        const userId = req.user._id || req.user.id;
        const risk = await riskService.unlinkTest(req.params.id, userId, req.params.testCaseId);

        if (!risk) {
            return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Risk vector not found or access denied' });
        }

        logger.info(`Unlinked test ${req.params.testCaseId} from risk ${req.params.id} by user ${userId}`);
        res.json({ success: true, data: risk });
    } catch (err) {
        next(err);
    }
};

exports.exportRisks = async (req, res, next) => {
    try {
        const format = (req.query.format || 'json').toLowerCase();
        const suiteId = req.query.suite_id || 'all';
        const userId = req.user._id || req.user.id;

        const result = await riskService.exportRisks({ userId, suiteId, format });

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="risk_vectors_${suiteId}_${Date.now()}.csv"`);
            return res.send(result);
        }

        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};

exports.getExecutionFailures = async (req, res) => {
    // Strictly respond 501 while test execution feature flag is disabled
    return res.status(501).json({
        success: false,
        code: 'FEATURE_DISABLED',
        message: 'Live test execution reporting is planned and not yet available. Test execution is currently disabled.'
    });
};
