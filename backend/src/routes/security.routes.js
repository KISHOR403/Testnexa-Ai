/**
 * TestNexa AI — Enterprise Security & Administration Routes
 */

const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
    requireOrgAccess,
    requireOrgRole,
    requireOrgPermission
} = require('../middleware/orgAuth.middleware');
const securityController = require('../controllers/security.controller');

const router = express.Router({ mergeParams: true });

// =============================================================================
// User-Level Security (MFA & Sessions)
// =============================================================================

router.post('/mfa/setup', protect, securityController.setupMfa);
router.post('/mfa/verify', protect, securityController.verifyAndEnableMfa);
router.post('/mfa/disable', protect, securityController.disableMfa);
router.post('/mfa/recovery-codes/regenerate', protect, securityController.regenerateRecoveryCodes);
router.get('/mfa/status', protect, securityController.getMfaStatus);

router.get('/sessions', protect, securityController.listSessions);
router.delete('/sessions/:sessionId', protect, securityController.revokeSession);
router.post('/sessions/revoke-others', protect, securityController.revokeAllOtherSessions);

// =============================================================================
// Organization-Scoped Enterprise Security
// =============================================================================

// SSO Management
router.get('/organizations/:id/sso', protect, requireOrgAccess, requireOrgPermission('security.view'), securityController.getSsoConfig);
router.post('/organizations/:id/sso', protect, requireOrgAccess, requireOrgPermission('security.sso.manage'), securityController.configureSso);
router.post('/organizations/:id/sso/test', protect, requireOrgAccess, requireOrgPermission('security.sso.manage'), securityController.testSsoConfig);
router.patch('/organizations/:id/sso/enforce', protect, requireOrgAccess, requireOrgPermission('security.sso.manage'), securityController.toggleSsoEnforcement);
router.delete('/organizations/:id/sso', protect, requireOrgAccess, requireOrgPermission('security.sso.manage'), securityController.deleteSsoConfig);

// API Keys Management
router.get('/organizations/:id/api-keys', protect, requireOrgAccess, requireOrgPermission('security.view'), securityController.listApiKeys);
router.post('/organizations/:id/api-keys', protect, requireOrgAccess, requireOrgPermission('security.apikeys.manage'), securityController.createApiKey);
router.post('/organizations/:id/api-keys/:keyId/rotate', protect, requireOrgAccess, requireOrgPermission('security.apikeys.manage'), securityController.rotateApiKey);
router.delete('/organizations/:id/api-keys/:keyId', protect, requireOrgAccess, requireOrgPermission('security.apikeys.manage'), securityController.revokeApiKey);

// Security Policies
router.get('/organizations/:id/policies', protect, requireOrgAccess, requireOrgPermission('security.view'), securityController.getSecurityPolicy);
router.put('/organizations/:id/policies', protect, requireOrgAccess, requireOrgPermission('security.policies.manage'), securityController.updateSecurityPolicy);

// IP Allowlist
router.get('/organizations/:id/ip-allowlist', protect, requireOrgAccess, requireOrgPermission('security.view'), securityController.listIpAllowlist);
router.post('/organizations/:id/ip-allowlist', protect, requireOrgAccess, requireOrgPermission('security.policies.manage'), securityController.addIpAllowlistEntry);
router.delete('/organizations/:id/ip-allowlist/:entryId', protect, requireOrgAccess, requireOrgPermission('security.policies.manage'), securityController.removeIpAllowlistEntry);
router.get('/organizations/:id/ip-allowlist/my-ip', protect, requireOrgAccess, securityController.getClientIpContext);

// Security Event History
router.get('/organizations/:id/events', protect, requireOrgAccess, requireOrgPermission('security.audit.view'), securityController.listSecurityEvents);

module.exports = router;

