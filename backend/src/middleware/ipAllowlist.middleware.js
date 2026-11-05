/**
 * TestNexa AI — IP Allowlist Enforcement Middleware
 * 
 * Verifies that the client IP belongs to the organization's approved CIDRs/IPs
 * when the IP allowlist policy is enabled.
 */

const securityService = require('../services/security.service');
const supabaseService = require('../services/supabaseData.service');
const auditService = require('../services/auditService');
const logger = require('../utils/logger');

/**
 * Middleware to enforce organization IP allowlist
 */
const enforceIpAllowlist = async (req, res, next) => {
    try {
        const orgId = req.org?.id || req.params?.orgId || req.params?.id || req.headers?.['x-organization-id'];
        if (!orgId) {
            return next();
        }

        const policy = await supabaseService.getOrgSecurityPolicy(orgId);
        if (!policy || !policy.ipAllowlistEnabled) {
            return next();
        }

        const allowlist = await supabaseService.getIpAllowlist(orgId);
        if (!allowlist || allowlist.length === 0) {
            // Safety: if allowlist is empty, do not lock out the organization
            return next();
        }

        const clientIp = securityService.extractClientIp(req);
        const allowed = securityService.validateIpAllowlist(clientIp, allowlist);

        if (!allowed) {
            // Record security event
            await supabaseService.recordSecurityEvent({
                orgId,
                eventType: 'security.ip_blocked',
                severity: 'warning',
                description: `Blocked access attempt from unauthorized IP: ${clientIp}`,
                ipAddress: clientIp,
                userAgent: req.get('user-agent'),
                metadata: {
                    endpoint: req.originalUrl,
                    method: req.method
                }
            });

            await auditService.log({
                orgId,
                action: 'security.ip_blocked',
                resourceType: 'network',
                resourceId: clientIp,
                resourceDisplayName: `Blocked Client IP (${clientIp})`,
                outcome: 'Denied',
                source: 'API',
                metadata: { clientIp, url: req.originalUrl }
            });

            return res.status(403).json({
                success: false,
                code: 'IP_NOT_ALLOWED',
                message: `Access denied: Client IP ${clientIp} is not authorized by organization IP allowlist policy`,
                data: {
                    clientIp
                }
            });
        }

        next();
    } catch (err) {
        logger.error('IP allowlist check error:', err.message);
        next();
    }
};

module.exports = {
    enforceIpAllowlist
};

