/**
 * TestNexa AI — Organization & Team Management Controller
 */

const supabaseService = require('../services/supabaseData.service');
const { isValidRole, getRoleMeta, ROLES } = require('../utils/rbac');
const logger = require('../utils/logger');

/**
 * GET /api/v1/organizations
 * List all organizations the authenticated user belongs to
 */
exports.getUserOrganizations = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const userName = req.user.name || req.user.displayName || '';

        const orgs = await supabaseService.getUserOrganizations(userId, userName);
        res.json({
            success: true,
            data: orgs
        });
    } catch (err) {
        logger.error('Error fetching user organizations:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/v1/organizations/:id
 * Retrieve organization profile & summary
 */
exports.getOrganizationDetails = async (req, res) => {
    try {
        const org = req.org; // populated by requireOrgAccess
        const [members, workspaces] = await Promise.all([
            supabaseService.getOrgMembers(org.id),
            supabaseService.getOrgWorkspaces(org.id, false)
        ]);

        res.json({
            success: true,
            data: {
                ...org,
                userRole: req.orgRole,
                memberCount: members.length,
                workspaceCount: workspaces.length
            }
        });
    } catch (err) {
        logger.error('Error fetching organization details:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/v1/organizations
 * Create a new team organization
 */
exports.createOrganization = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { name, description } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Organization name is required' });
        }

        const org = await supabaseService.createOrganization({
            name: name.trim(),
            description: description || '',
            ownerId: userId
        });

        res.status(201).json({
            success: true,
            data: org,
            message: 'Organization created successfully'
        });
    } catch (err) {
        logger.error('Error creating organization:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * PATCH /api/v1/organizations/:id
 * Update organization profile or settings
 */
exports.updateOrganization = async (req, res) => {
    try {
        const orgId = req.org.id;
        const { name, description, settings } = req.body;

        const updated = await supabaseService.updateOrganization(orgId, {
            name,
            description,
            settings
        });

        await supabaseService.recordOrgAuditLog({
            orgId,
            actorId: req.user._id || req.user.id,
            action: 'organization.updated',
            targetType: 'organization',
            targetId: orgId,
            details: { name: updated.name }
        });

        res.json({
            success: true,
            data: updated,
            message: 'Organization updated'
        });
    } catch (err) {
        logger.error('Error updating organization:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * DELETE /api/v1/organizations/:id
 * Delete organization (owner only)
 */
exports.deleteOrganization = async (req, res) => {
    try {
        const orgId = req.org.id;
        const userId = req.user._id || req.user.id;

        await supabaseService.deleteOrganization(orgId, userId);

        res.json({
            success: true,
            message: 'Organization permanently deleted'
        });
    } catch (err) {
        logger.error('Error deleting organization:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/v1/organizations/:id/transfer-ownership
 * Transfer organization ownership to another active member (owner only)
 */
exports.transferOwnership = async (req, res) => {
    try {
        const orgId = req.org.id;
        const currentOwnerId = req.user._id || req.user.id;
        const { newOwnerId } = req.body;

        if (!newOwnerId) {
            return res.status(400).json({ success: false, message: 'newOwnerId is required' });
        }

        const org = await supabaseService.transferOrgOwnership(orgId, newOwnerId, currentOwnerId);

        res.json({
            success: true,
            data: org,
            message: 'Ownership transferred successfully'
        });
    } catch (err) {
        logger.error('Error transferring ownership:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/v1/organizations/:id/members
 * List all members of the organization
 */
exports.listMembers = async (req, res) => {
    try {
        const orgId = req.org.id;
        const members = await supabaseService.getOrgMembers(orgId);

        // Append role metadata
        const enriched = members.map(m => ({
            ...m,
            roleMeta: getRoleMeta(m.role)
        }));

        res.json({
            success: true,
            data: enriched
        });
    } catch (err) {
        logger.error('Error listing organization members:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * PATCH /api/v1/organizations/:id/members/:userId
 * Update member's role
 */
exports.updateMemberRole = async (req, res) => {
    try {
        const orgId = req.org.id;
        const targetUserId = req.params.userId;
        const { role } = req.body;

        if (!role || !isValidRole(role)) {
            return res.status(400).json({
                success: false,
                message: `Invalid role. Allowed roles: ${Object.values(ROLES).join(', ')}`
            });
        }

        const member = await supabaseService.updateOrgMemberRole(orgId, targetUserId, role);

        await supabaseService.recordOrgAuditLog({
            orgId,
            actorId: req.user._id || req.user.id,
            action: 'member.role_changed',
            targetType: 'user',
            targetId: targetUserId,
            details: { newRole: role }
        });

        res.json({
            success: true,
            data: member,
            message: `Member role updated to ${role}`
        });
    } catch (err) {
        logger.error('Error updating member role:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * DELETE /api/v1/organizations/:id/members/:userId
 * Remove a member from the organization
 */
exports.removeMember = async (req, res) => {
    try {
        const orgId = req.org.id;
        const targetUserId = req.params.userId;

        await supabaseService.removeOrgMember(orgId, targetUserId);

        await supabaseService.recordOrgAuditLog({
            orgId,
            actorId: req.user._id || req.user.id,
            action: 'member.removed',
            targetType: 'user',
            targetId: targetUserId
        });

        res.json({
            success: true,
            message: 'Member removed from organization'
        });
    } catch (err) {
        logger.error('Error removing member:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/v1/organizations/:id/invitations
 * List invitations for organization
 */
exports.listInvitations = async (req, res) => {
    try {
        const orgId = req.org.id;
        const status = req.query.status || 'pending';
        const invitations = await supabaseService.getOrgInvitations(orgId, status);

        res.json({
            success: true,
            data: invitations
        });
    } catch (err) {
        logger.error('Error listing invitations:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/v1/organizations/:id/invitations
 * Create and send an organization invitation
 */
exports.createInvitation = async (req, res) => {
    try {
        const orgId = req.org.id;
        const userId = req.user._id || req.user.id;
        const { email, role, message } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, message: 'Valid email address is required' });
        }
        if (role && !isValidRole(role)) {
            return res.status(400).json({ success: false, message: `Invalid role: ${role}` });
        }

        const invitation = await supabaseService.createOrgInvitation({
            orgId,
            email,
            role: role || 'qa_engineer',
            invitedBy: userId,
            message
        });

        res.status(201).json({
            success: true,
            data: {
                id: invitation.id,
                email: invitation.email,
                role: invitation.role,
                status: invitation.status,
                expiresAt: invitation.expiresAt,
                // Provide token in response so invite link can be shown or copied
                invitationLink: `/invitations/${invitation.token}`
            },
            message: `Invitation generated for ${invitation.email}`
        });
    } catch (err) {
        logger.error('Error creating invitation:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * DELETE /api/v1/organizations/:id/invitations/:invitationId
 * Cancel an active invitation
 */
exports.cancelInvitation = async (req, res) => {
    try {
        const orgId = req.org.id;
        const { invitationId } = req.params;

        const cancelled = await supabaseService.cancelOrgInvitation(orgId, invitationId);
        if (!cancelled) {
            return res.status(404).json({ success: false, message: 'Invitation not found' });
        }

        res.json({
            success: true,
            message: 'Invitation cancelled'
        });
    } catch (err) {
        logger.error('Error cancelling invitation:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/v1/organizations/:id/invitations/:invitationId/resend
 * Resend invitation
 */
exports.resendInvitation = async (req, res) => {
    try {
        const orgId = req.org.id;
        const { invitationId } = req.params;

        const invitation = await supabaseService.resendOrgInvitation(orgId, invitationId);

        res.json({
            success: true,
            data: {
                id: invitation.id,
                email: invitation.email,
                expiresAt: invitation.expiresAt,
                invitationLink: `/invitations/${invitation.token}`
            },
            message: `Invitation resent to ${invitation.email}`
        });
    } catch (err) {
        logger.error('Error resending invitation:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/v1/organizations/invitations/:token/accept
 * Accept an organization invitation
 */
exports.acceptInvitation = async (req, res) => {
    try {
        const { token } = req.params;
        const userId = req.user._id || req.user.id;
        const userEmail = req.user.email || '';

        const member = await supabaseService.acceptOrgInvitation(token, userId, userEmail);

        res.json({
            success: true,
            data: member,
            message: 'Invitation accepted! You are now a member of the organization.'
        });
    } catch (err) {
        logger.error('Error accepting invitation:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/v1/organizations/invitations/:token/reject
 * Reject an organization invitation
 */
exports.rejectInvitation = async (req, res) => {
    try {
        const { token } = req.params;
        await supabaseService.rejectOrgInvitation(token);
        res.json({
            success: true,
            message: 'Invitation declined'
        });
    } catch (err) {
        logger.error('Error rejecting invitation:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/v1/organizations/:id/workspaces
 * List all workspaces in the organization
 */
exports.listWorkspaces = async (req, res) => {
    try {
        const orgId = req.org.id;
        const includeArchived = req.query.includeArchived === 'true';
        const workspaces = await supabaseService.getOrgWorkspaces(orgId, includeArchived);

        res.json({
            success: true,
            data: workspaces
        });
    } catch (err) {
        logger.error('Error listing organization workspaces:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/v1/organizations/:id/workspaces
 * Create a workspace inside this organization
 */
exports.createWorkspace = async (req, res) => {
    try {
        const orgId = req.org.id;
        const userId = req.user._id || req.user.id;
        const { name, description, visibility } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Workspace name is required' });
        }

        const workspace = await supabaseService.createOrgWorkspace(orgId, {
            name: name.trim(),
            description,
            ownerId: userId,
            visibility
        });

        res.status(201).json({
            success: true,
            data: workspace,
            message: 'Workspace created successfully'
        });
    } catch (err) {
        logger.error('Error creating workspace:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * PATCH /api/v1/organizations/:id/workspaces/:workspaceId/archive
 * Archive or unarchive a workspace
 */
exports.archiveWorkspace = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const isArchived = req.body.isArchived !== undefined ? req.body.isArchived : true;

        const updated = await supabaseService.archiveWorkspace(workspaceId, isArchived);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Workspace not found' });
        }

        res.json({
            success: true,
            data: updated,
            message: isArchived ? 'Workspace archived' : 'Workspace unarchived'
        });
    } catch (err) {
        logger.error('Error toggling workspace archive:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/v1/organizations/:id/activity
 * Get organization activity & audit log
 */
exports.getActivity = async (req, res) => {
    try {
        const orgId = req.org.id;
        const limit = req.query.limit || 50;
        const logs = await supabaseService.getOrgAuditLogs(orgId, limit);

        res.json({
            success: true,
            data: logs
        });
    } catch (err) {
        logger.error('Error listing organization activity:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

