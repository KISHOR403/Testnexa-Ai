/**
 * TestNexa AI — API Key Authentication & Scope Middleware
 * 
 * Verifies high-entropy API keys against stored SHA-256 hashes,
 * enforces organization scope, and checks granular permissions.
 */

const securityService = require('../services/security.service');
const supabaseService = require('../services/supabaseData.service');
const auditService = require('../services/auditService');
const logger = require('../utils/logger');

/**
 * Middleware to authenticate request via organization API key
 */
const authenticateApiKey = async (req, res, next) => {
    let rawKey = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer tnx_live_')) {
        rawKey = req.headers.authorization.split(' ')[1];
    } else if (req.headers['x-api-key'] && req.headers['x-api-key'].startsWith('tnx_live_')) {
        rawKey = req.headers['x-api-key'];
    }

    if (!rawKey) {
        return res.status(401).json({
            success: false,
            code: 'API_KEY_REQUIRED',
            message: 'A valid API key starting with tnx_live_ is required in the Authorization or x-api-key header'
        });
    }

    try {
        const { valid, keyRecord, reason } = await securityService.validateApiKey(rawKey);

        if (!valid || !keyRecord) {
            return res.status(401).json({
                success: false,
                code: 'INVALID_API_KEY',
                message: reason || 'Invalid or revoked API key'
            });
        }

        const org = await supabaseService.getOrganization(keyRecord.orgId);
        if (!org || org.status !== 'active') {
            return res.status(403).json({
                success: false,
                code: 'ORGANIZATION_INACTIVE',
                message: 'The organization associated with this API key is inactive'
            });
        }

        // Attach key and organization context to request
        req.apiKey = keyRecord;
        req.org = org;
        req.isApiKey = true;
        req.user = {
            id: keyRecord.createdBy,
            _id: keyRecord.createdBy,
            name: `API Key (${keyRecord.name})`,
            email: `apikey_${keyRecord.keyPrefix}@system.local`,
            role: 'api_client',
            isApiKey: true
        };

        next();
    } catch (err) {
        logger.error('API key authentication error:', err.message);
        res.status(500).json({ success: false, message: 'Authentication error' });
    }
};

/**
 * Middleware to require a specific API key scope (e.g. 'executions:trigger')
 */
const requireApiKeyScope = (requiredScope) => {
    return (req, res, next) => {
        if (!req.apiKey) {
            return res.status(401).json({
                success: false,
                code: 'API_KEY_REQUIRED',
                message: 'API key authentication required'
            });
        }

        const scopes = req.apiKey.scopes || [];
        if (!scopes.includes(requiredScope) && !scopes.includes('*')) {
            return res.status(403).json({
                success: false,
                code: 'INSUFFICIENT_SCOPE',
                message: `API key lacks required scope: ${requiredScope}`,
                data: {
                    requiredScope,
                    grantedScopes: scopes
                }
            });
        }

        next();
    };
};

module.exports = {
    authenticateApiKey,
    requireApiKeyScope
};

