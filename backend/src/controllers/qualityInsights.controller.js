/**
 * TestNexa AI — Quality Insights & Advanced Analytics Controller
 */

const qualityInsightsService = require('../services/qualityInsights.service');
const supabaseService = require('../services/supabaseData.service');
const { hasOrgPermission } = require('../utils/rbac');
const logger = require('../utils/logger');

/**
 * Helper to resolve target workspace and verify user access
 */
async function resolveWorkspaceContext(req) {
    const userId = req.user?._id || req.user?.id;
    let workspaceId = req.query?.workspaceId || req.headers['x-workspace-id'] || req.body?.workspaceId;

    if (!workspaceId) {
        // Find user's default workspace
        for (const ws of supabaseService.inMemoryWorkspaces.values()) {
            if (ws.ownerId === userId || ws.owner_id === userId) {
                workspaceId = ws.id;
                break;
            }
        }
    }

    if (!workspaceId) {
        throw new Error('Workspace context is required for Quality Insights');
    }

    const ws = await supabaseService.getWorkspace(workspaceId);
    if (!ws) {
        const err = new Error('Workspace not found');
        err.statusCode = 404;
        throw err;
    }

    // Access check: User must be owner, member, or org member
    const isOwner = String(ws.ownerId || ws.owner_id) === String(userId);
    const isMember = (ws.members || []).some(m => String(m.userId) === String(userId));
    if (!isOwner && !isMember) {
        // Check organization membership if workspace belongs to an org
        if (ws.organizationId) {
            const orgMember = await supabaseService.getOrgMember(ws.organizationId, userId);
            if (!orgMember || orgMember.status !== 'active') {
                const err = new Error('Forbidden: You do not have access to this workspace');
                err.statusCode = 403;
                throw err;
            }
        } else {
            const err = new Error('Forbidden: You do not have access to this workspace');
            err.statusCode = 403;
            throw err;
        }
    }

    return {
        workspaceId,
        workspace: ws,
        orgId: ws.organizationId || null
    };
}

/**
 * Extract query filters from request
 */
function extractFilters(req) {
    return {
        suiteId: req.query?.suiteId || null,
        dateRange: req.query?.dateRange || '30d',
        startDate: req.query?.startDate || null,
        endDate: req.query?.endDate || null,
        environment: req.query?.environment || 'all',
        browser: req.query?.browser || 'all',
        executionType: req.query?.executionType || 'all',
        status: req.query?.status || 'all',
        interval: req.query?.interval || 'daily'
    };
}

/**
 * GET /api/v1/analytics/quality-insights/overview
 * Consolidated Quality Insights Workspace payload
 */
exports.getOverview = async (req, res) => {
    try {
        const { workspaceId } = await resolveWorkspaceContext(req);
        const filters = extractFilters(req);
        const data = await qualityInsightsService.getQualityInsightsOverview(workspaceId, filters);

        res.json({
            success: true,
            data
        });
    } catch (err) {
        logger.error('Error in getQualityInsightsOverview:', err);
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message
        });
    }
};

/**
 * GET /api/v1/analytics/quality-insights/health
 * Execution Health KPIs, rates, and metric definitions
 */
exports.getHealth = async (req, res) => {
    try {
        const { workspaceId } = await resolveWorkspaceContext(req);
        const filters = extractFilters(req);
        const { runs } = await qualityInsightsService._getFilteredRunsWithCases(workspaceId, filters);
        const health = qualityInsightsService.calculateExecutionHealth(runs);

        res.json({
            success: true,
            data: health
        });
    } catch (err) {
        logger.error('Error in getHealth:', err);
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message
        });
    }
};

/**
 * GET /api/v1/analytics/quality-insights/trends
 * Historical execution trends time-series
 */
exports.getTrends = async (req, res) => {
    try {
        const { workspaceId } = await resolveWorkspaceContext(req);
        const filters = extractFilters(req);
        const { runs, boundaries } = await qualityInsightsService._getFilteredRunsWithCases(workspaceId, filters);
        const trends = qualityInsightsService.calculateExecutionTrends(runs, boundaries, filters.interval);

        res.json({
            success: true,
            data: trends
        });
    } catch (err) {
        logger.error('Error in getTrends:', err);
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message
        });
    }
};

/**
 * GET /api/v1/analytics/quality-insights/failures
 * Top failing cases, error signatures, environment & browser distributions
 */
exports.getFailures = async (req, res) => {
    try {
        const { workspaceId } = await resolveWorkspaceContext(req);
        const filters = extractFilters(req);
        const { runs } = await qualityInsightsService._getFilteredRunsWithCases(workspaceId, filters);
        const failures = qualityInsightsService.calculateFailureIntelligence(runs);

        res.json({
            success: true,
            data: failures
        });
    } catch (err) {
        logger.error('Error in getFailures:', err);
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message
        });
    }
};

/**
 * GET /api/v1/analytics/quality-insights/flaky
 * Grounded statistical flaky test detection
 */
exports.getFlaky = async (req, res) => {
    try {
        const { workspaceId } = await resolveWorkspaceContext(req);
        const filters = extractFilters(req);
        const { runs } = await qualityInsightsService._getFilteredRunsWithCases(workspaceId, filters);
        const flaky = qualityInsightsService.calculateFlakyAnalytics(runs);

        res.json({
            success: true,
            data: flaky
        });
    } catch (err) {
        logger.error('Error in getFlaky:', err);
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message
        });
    }
};

/**
 * GET /api/v1/analytics/quality-insights/suite-comparison
 * Test Suite Quality Comparison Matrix
 */
exports.getSuiteComparison = async (req, res) => {
    try {
        const { workspaceId } = await resolveWorkspaceContext(req);
        const filters = extractFilters(req);
        const { runs } = await qualityInsightsService._getFilteredRunsWithCases(workspaceId, filters);
        const suiteComparison = qualityInsightsService.calculateSuiteComparison(runs);

        res.json({
            success: true,
            data: suiteComparison
        });
    } catch (err) {
        logger.error('Error in getSuiteComparison:', err);
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message
        });
    }
};

/**
 * POST /api/v1/analytics/quality-insights/ai-insights
 * Generate AI-Assisted Quality Insights with Quota Metering
 */
exports.generateAIInsights = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { workspaceId, orgId } = await resolveWorkspaceContext(req);
        const filters = extractFilters(req);

        const result = await qualityInsightsService.generateAIQualityInsights(
            workspaceId,
            orgId,
            userId,
            filters
        );

        res.json({
            success: true,
            data: result
        });
    } catch (err) {
        logger.error('Error generating AI quality insights:', err);
        res.status(err.statusCode || (err.code === 'QUOTA_EXCEEDED' ? 403 : 500)).json({
            success: false,
            code: err.code || 'AI_GENERATION_FAILED',
            message: err.message,
            data: err.data || null
        });
    }
};

/**
 * GET /api/v1/analytics/quality-insights/export
 * Export Filtered Quality Insights Report as CSV (Formula-Injection Protected)
 */
exports.exportCSV = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { workspaceId, orgId } = await resolveWorkspaceContext(req);

        // RBAC check: If org is present, verify export permission
        if (orgId) {
            const member = await supabaseService.getOrgMember(orgId, userId);
            const userRole = member?.role || 'viewer';
            if (!hasOrgPermission(userRole, 'analytics.export') && !hasOrgPermission(userRole, 'audit.export')) {
                return res.status(403).json({
                    success: false,
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to export analytics reports'
                });
            }
        }

        const filters = extractFilters(req);
        const csvContent = await qualityInsightsService.generateCSVExport(workspaceId, filters);

        const filename = `testnexa-quality-insights-${workspaceId}-${new Date().toISOString().slice(0, 10)}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(csvContent);
    } catch (err) {
        logger.error('Error exporting quality insights CSV:', err);
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message
        });
    }
};
