/**
 * TestNexa AI — Organization & Team Management Routes
 */

const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
    requireOrgAccess,
    requireOrgRole,
    requireOrgPermission
} = require('../middleware/orgAuth.middleware');
const {
    getUserOrganizations,
    getOrganizationDetails,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    transferOwnership,
    listMembers,
    updateMemberRole,
    removeMember,
    listInvitations,
    createInvitation,
    cancelInvitation,
    resendInvitation,
    acceptInvitation,
    rejectInvitation,
    listWorkspaces,
    createWorkspace,
    archiveWorkspace,
    getActivity,
    listAuditLogs,
    getAuditLogDetails,
    exportAuditLogs,
    getOrganizationUsage,
    getUsageHistory,
    getUsageWarnings
} = require('../controllers/organization.controller');

const router = express.Router();

// Public / Token-authenticated invitation endpoints
router.post('/invitations/:token/accept', protect, acceptInvitation);
router.post('/invitations/:token/reject', rejectInvitation);

// Authenticated Organization listing & creation
router.get('/', protect, getUserOrganizations);
router.post('/', protect, createOrganization);

// Scoped Organization operations (enforces organization boundary & RBAC)
router.get('/:id', protect, requireOrgAccess, getOrganizationDetails);
router.patch('/:id', protect, requireOrgAccess, requireOrgRole(['owner', 'admin']), updateOrganization);
router.delete('/:id', protect, requireOrgAccess, requireOrgRole('owner'), deleteOrganization);
router.post('/:id/transfer-ownership', protect, requireOrgAccess, requireOrgRole('owner'), transferOwnership);

// Team Member Management
router.get('/:id/members', protect, requireOrgAccess, listMembers);
router.patch('/:id/members/:userId', protect, requireOrgAccess, requireOrgRole(['owner', 'admin']), updateMemberRole);
router.delete('/:id/members/:userId', protect, requireOrgAccess, requireOrgRole(['owner', 'admin']), removeMember);

// Team Invitations
router.get('/:id/invitations', protect, requireOrgAccess, requireOrgRole(['owner', 'admin']), listInvitations);
router.post('/:id/invitations', protect, requireOrgAccess, requireOrgRole(['owner', 'admin']), createInvitation);
router.delete('/:id/invitations/:invitationId', protect, requireOrgAccess, requireOrgRole(['owner', 'admin']), cancelInvitation);
router.post('/:id/invitations/:invitationId/resend', protect, requireOrgAccess, requireOrgRole(['owner', 'admin']), resendInvitation);

// Team Workspaces
router.get('/:id/workspaces', protect, requireOrgAccess, listWorkspaces);
router.post('/:id/workspaces', protect, requireOrgAccess, requireOrgRole(['owner', 'admin']), createWorkspace);
router.patch('/:id/workspaces/:workspaceId/archive', protect, requireOrgAccess, requireOrgRole(['owner', 'admin']), archiveWorkspace);

// Organization Audit Trail
router.get('/:id/activity', protect, requireOrgAccess, requireOrgRole(['owner', 'admin', 'qa_manager']), getActivity);
router.get('/:id/audit-logs', protect, requireOrgAccess, requireOrgPermission('audit.view'), listAuditLogs);
router.get('/:id/audit-logs/export', protect, requireOrgAccess, requireOrgPermission('audit.export'), exportAuditLogs);
router.get('/:id/audit-logs/:eventId', protect, requireOrgAccess, requireOrgPermission('audit.view'), getAuditLogDetails);

// Organization Usage & Quotas
router.get('/:id/usage', protect, requireOrgAccess, getOrganizationUsage);
router.get('/:id/usage/history', protect, requireOrgAccess, getUsageHistory);
router.get('/:id/usage/warnings', protect, requireOrgAccess, getUsageWarnings);

// Organization Enterprise Security
const securityController = require('../controllers/security.controller');

// SSO Management
router.get('/:id/security/sso', protect, requireOrgAccess, requireOrgPermission('security.view'), securityController.getSsoConfig);
router.post('/:id/security/sso', protect, requireOrgAccess, requireOrgPermission('security.sso.manage'), securityController.configureSso);
router.post('/:id/security/sso/test', protect, requireOrgAccess, requireOrgPermission('security.sso.manage'), securityController.testSsoConfig);
router.patch('/:id/security/sso/enforce', protect, requireOrgAccess, requireOrgPermission('security.sso.manage'), securityController.toggleSsoEnforcement);
router.delete('/:id/security/sso', protect, requireOrgAccess, requireOrgPermission('security.sso.manage'), securityController.deleteSsoConfig);

// API Keys Management
router.get('/:id/security/api-keys', protect, requireOrgAccess, requireOrgPermission('security.view'), securityController.listApiKeys);
router.post('/:id/security/api-keys', protect, requireOrgAccess, requireOrgPermission('security.apikeys.manage'), securityController.createApiKey);
router.post('/:id/security/api-keys/:keyId/rotate', protect, requireOrgAccess, requireOrgPermission('security.apikeys.manage'), securityController.rotateApiKey);
router.delete('/:id/security/api-keys/:keyId', protect, requireOrgAccess, requireOrgPermission('security.apikeys.manage'), securityController.revokeApiKey);

// Security Policies
router.get('/:id/security/policies', protect, requireOrgAccess, requireOrgPermission('security.view'), securityController.getSecurityPolicy);
router.put('/:id/security/policies', protect, requireOrgAccess, requireOrgPermission('security.policies.manage'), securityController.updateSecurityPolicy);

// IP Allowlist
router.get('/:id/security/ip-allowlist', protect, requireOrgAccess, requireOrgPermission('security.view'), securityController.listIpAllowlist);
router.post('/:id/security/ip-allowlist', protect, requireOrgAccess, requireOrgPermission('security.policies.manage'), securityController.addIpAllowlistEntry);
router.delete('/:id/security/ip-allowlist/:entryId', protect, requireOrgAccess, requireOrgPermission('security.policies.manage'), securityController.removeIpAllowlistEntry);
router.get('/:id/security/ip-allowlist/my-ip', protect, requireOrgAccess, securityController.getClientIpContext);

// Security Event History
router.get('/:id/security/events', protect, requireOrgAccess, requireOrgPermission('security.audit.view'), securityController.listSecurityEvents);

module.exports = router;

