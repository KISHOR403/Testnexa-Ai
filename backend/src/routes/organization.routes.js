/**
 * TestNexa AI — Organization & Team Management Routes
 */

const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
    requireOrgAccess,
    requireOrgRole
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
    getActivity
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

module.exports = router;

