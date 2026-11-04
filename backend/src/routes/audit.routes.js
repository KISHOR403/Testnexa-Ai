/**
 * TestNexa AI — Audit & Resource Activity Routes
 */

const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const auditService = require('../services/auditService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/v1/audit/resource/:resourceType/:resourceId
 * Retrieve contextual audit & activity history for an individual resource
 * (e.g., project, suite, testcase, execution, workspace)
 */
router.get('/resource/:resourceType/:resourceId', protect, async (req, res) => {
    try {
        const { resourceType, resourceId } = req.params;
        const { limit = 20, orgId } = req.query;

        const history = await auditService.getResourceActivity(resourceType, resourceId, {
            orgId: orgId || null,
            limit: parseInt(limit, 10) || 20
        });

        res.json({
            success: true,
            data: history,
            resourceType,
            resourceId
        });
    } catch (err) {
        logger.error('Error fetching resource activity history:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;

