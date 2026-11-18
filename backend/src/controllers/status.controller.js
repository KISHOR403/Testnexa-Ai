/**
 * Testnexa AI — Public System Status Controller
 * Exposes GET /api/v1/status with 30-second caching headers and real component health checks.
 */

const statusService = require('../services/status.service');

exports.getPublicStatus = async (req, res) => {
    try {
        const forceFresh = req.query.fresh === 'true';
        const data = await statusService.getStatus(forceFresh);

        // Public cache header for CDNs and browsers: 30 seconds
        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');

        return res.status(200).json(data);
    } catch (err) {
        // Fallback safety: If an unexpected crash occurs during status evaluation,
        // it must NEVER return 'operational'!
        res.setHeader('Cache-Control', 'no-cache');
        return res.status(503).json({
            status: 'outage',
            checkedAt: new Date().toISOString(),
            components: [
                {
                    name: 'api',
                    status: 'degraded',
                    message: err.message
                },
                {
                    name: 'database',
                    status: 'outage'
                },
                {
                    name: 'ai_provider',
                    status: 'degraded'
                }
            ]
        });
    }
};
