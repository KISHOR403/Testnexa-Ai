/**
 * TestNexa AI — Organization & RBAC Authorization Middleware
 * Enforces organization boundary checks, member status validation, and centralized RBAC permissions.
 */

const supabaseService = require('../services/supabaseData.service');
const { hasOrgPermission, isRoleAtLeast, ROLES } = require('../utils/rbac');
const logger = require('../utils/logger');

/**
 * Resolves the target organization ID from request parameters, query, body, or header
 */
function resolveOrgId(req) {
    if (req.params?.orgId) return req.params.orgId;
    if (req.params?.id && req.baseUrl?.includes('organizations')) return req.params.id;
    if (req.body?.orgId) return req.body.orgId;
    if (req.query?.orgId) return req.query.orgId;
    if (req.headers['x-organization-id']) return req.headers['x-organization-id'];
    return null;
}

/**
 * Middleware: Verifies user is an active member of the target organization
 */
async function requireOrgAccess(req, res, next) {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required' });
        }

        const orgId = resolveOrgId(req);
        if (!orgId) {
            return res.status(400).json({ success: false, code: 'ORG_CONTEXT_REQUIRED', message: 'Organization context not provided' });
        }

        const org = await supabaseService.getOrganization(orgId);
        if (!org) {
            return res.status(404).json({ success: false, code: 'ORG_NOT_FOUND', message: 'Organization not found' });
        }

        if (org.status !== 'active') {
            return res.status(403).json({ success: false, code: 'ORG_SUSPENDED', message: 'This organization is currently suspended' });
        }

        const member = await supabaseService.getOrgMember(orgId, userId);
        if (!member || member.status !== 'active') {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You are not an active member of this organization'
            });
        }

        req.org = org;
        req.orgMember = member;
        req.orgRole = (member.role || 'viewer').toLowerCase();

        next();
    } catch (err) {
        logger.error('Error in requireOrgAccess:', err);
        return res.status(500).json({ success: false, message: 'Internal authorization error' });
    }
}

/**
 * Middleware: Requires the user to have at least a specified role or be in a list of allowed roles
 * e.g., requireOrgRole(['owner', 'admin']) or requireOrgRole('admin')
 */
function requireOrgRole(allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    return (req, res, next) => {
        if (!req.orgRole) {
            return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'No organization role context found' });
        }

        const hasMatch = roles.some(role => isRoleAtLeast(req.orgRole, role) || req.orgRole === role.toLowerCase());
        if (!hasMatch) {
            return res.status(403).json({
                success: false,
                code: 'INSUFFICIENT_ROLE',
                message: `This action requires ${roles.join(' or ')} permissions. Your current role is ${req.orgRole}.`
            });
        }

        next();
    };
}

/**
 * Middleware: Requires a specific RBAC permission
 * e.g., requireOrgPermission('org:manage_settings')
 */
function requireOrgPermission(permission) {
    return (req, res, next) => {
        if (!req.orgRole) {
            return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'No organization role context found' });
        }

        if (!hasOrgPermission(req.orgRole, permission)) {
            return res.status(403).json({
                success: false,
                code: 'PERMISSION_DENIED',
                message: `Permission denied: ${permission} required`
            });
        }

        next();
    };
}

module.exports = {
    resolveOrgId,
    requireOrgAccess,
    requireOrgRole,
    requireOrgPermission
};

