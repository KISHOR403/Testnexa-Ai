/**
 * TestNexa AI — Quota Enforcement Middleware
 * 
 * Provides express middleware to enforce plan allowances and quota reservation
 * before expensive operations run.
 */

const usageMeteringService = require('../services/usageMetering.service');
const logger = require('../utils/logger');

/**
 * Express middleware to ensure organization has available quota for a metric
 */
const requireQuota = (metric, quantityResolver = 1) => {
    return async (req, res, next) => {
        try {
            const orgId = await usageMeteringService.resolveOrgForRequest(req);
            if (!orgId) {
                // If org cannot be resolved (e.g. standalone test context without org), continue gracefully
                return next();
            }

            const quantity = typeof quantityResolver === 'function' ? quantityResolver(req) : quantityResolver;
            const userId = req.user?._id || req.user?.id;
            const workspaceId = req.params?.workspaceId || req.body?.workspaceId || req.headers?.['x-workspace-id'];

            const reservation = await usageMeteringService.reserveQuota({
                orgId,
                workspaceId,
                userId,
                metric,
                quantity: Math.max(1, Number(quantity) || 1),
                operationId: `${metric}_${Date.now()}`
            });

            req.quotaReservation = reservation;
            req.orgId = orgId;

            // Automatically release if response fails or error occurs
            let finished = false;
            res.on('close', () => {
                if (!finished && res.statusCode >= 400 && req.quotaReservation) {
                    usageMeteringService.releaseReservation(req.quotaReservation.id);
                    req.quotaReservation = null;
                }
            });

            next();
        } catch (err) {
            if (err.code === 'QUOTA_EXCEEDED') {
                return res.status(403).json({
                    success: false,
                    code: 'QUOTA_EXCEEDED',
                    message: err.message,
                    data: err.data
                });
            }
            logger.warn('Quota check error:', err.message);
            next(err);
        }
    };
};

module.exports = {
    requireQuota
};

