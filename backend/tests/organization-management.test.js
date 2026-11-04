/**
 * TestNexa AI — Organization & Team Workspace Management Test Suite
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const supabaseService = require('../src/services/supabaseData.service');
const { hasOrgPermission, isRoleAtLeast, ROLES, PERMISSIONS } = require('../src/utils/rbac');
const { requireOrgAccess, requireOrgRole } = require('../src/middleware/orgAuth.middleware');
const orgController = require('../src/controllers/organization.controller');

test('Team Workspaces & Organization Management Suite', async (t) => {
    // Disable remote Supabase for deterministic test isolation
    supabaseService.workspacesTableAvailable = false;
    supabaseService.sessionsTableAvailable = false;
    supabaseService.executionTablesAvailable = false;

    // Reset in-memory org stores
    supabaseService.inMemoryOrganizations.clear();
    supabaseService.inMemoryOrgMembers.clear();
    supabaseService.inMemoryOrgInvitations.clear();
    supabaseService.inMemoryOrgAuditLogs = [];

    const ownerUser = {
        _id: 'usr_org_owner_' + Date.now(),
        id: 'usr_org_owner_' + Date.now(),
        name: 'Sarah Owner',
        email: 'sarah.owner@testnexa.ai'
    };
    const memberUser = {
        _id: 'usr_org_member_' + Date.now(),
        id: 'usr_org_member_' + Date.now(),
        name: 'David Engineer',
        email: 'david.engineer@testnexa.ai'
    };
    const foreignUser = {
        _id: 'usr_foreign_' + Date.now(),
        id: 'usr_foreign_' + Date.now(),
        name: 'External Stranger',
        email: 'stranger@external.io'
    };

    let org1;

    await t.test('1. Centralized RBAC: Validates roles, hierarchy, and permissions matrix', () => {
        // Owner permissions
        assert.equal(hasOrgPermission(ROLES.OWNER, PERMISSIONS.ORG_MANAGE_SETTINGS), true);
        assert.equal(hasOrgPermission(ROLES.OWNER, PERMISSIONS.ORG_TRANSFER_OWNERSHIP), true);
        assert.equal(hasOrgPermission(ROLES.OWNER, PERMISSIONS.ORG_DELETE), true);

        // Admin permissions
        assert.equal(hasOrgPermission(ROLES.ADMIN, PERMISSIONS.ORG_MANAGE_MEMBERS), true);
        assert.equal(hasOrgPermission(ROLES.ADMIN, PERMISSIONS.WORKSPACE_CREATE), true);
        assert.equal(hasOrgPermission(ROLES.ADMIN, PERMISSIONS.ORG_TRANSFER_OWNERSHIP), false, 'Admin cannot transfer ownership');
        assert.equal(hasOrgPermission(ROLES.ADMIN, PERMISSIONS.ORG_DELETE), false, 'Admin cannot delete org');

        // QA Manager permissions
        assert.equal(hasOrgPermission(ROLES.QA_MANAGER, PERMISSIONS.SUITE_MANAGE), true);
        assert.equal(hasOrgPermission(ROLES.QA_MANAGER, PERMISSIONS.ORG_MANAGE_MEMBERS), false);

        // QA Engineer permissions
        assert.equal(hasOrgPermission(ROLES.QA_ENGINEER, PERMISSIONS.TESTCASE_CREATE_EDIT), true);
        assert.equal(hasOrgPermission(ROLES.QA_ENGINEER, PERMISSIONS.EXECUTION_TRIGGER), true);
        assert.equal(hasOrgPermission(ROLES.QA_ENGINEER, PERMISSIONS.WORKSPACE_CREATE), false);

        // Viewer permissions
        assert.equal(hasOrgPermission(ROLES.VIEWER, PERMISSIONS.REPORT_VIEW), true);
        assert.equal(hasOrgPermission(ROLES.VIEWER, PERMISSIONS.EXECUTION_TRIGGER), false);
        assert.equal(hasOrgPermission(ROLES.VIEWER, PERMISSIONS.TESTCASE_CREATE_EDIT), false);

        // Role hierarchy
        assert.equal(isRoleAtLeast(ROLES.OWNER, ROLES.ADMIN), true);
        assert.equal(isRoleAtLeast(ROLES.ADMIN, ROLES.QA_ENGINEER), true);
        assert.equal(isRoleAtLeast(ROLES.VIEWER, ROLES.ADMIN), false);
    });

    await t.test('2. Organization Creation: Auto-registers creator as Owner with member record', async () => {
        org1 = await supabaseService.createOrganization({
            name: 'Acme QA Labs',
            description: 'Core Engineering QA Team',
            ownerId: ownerUser.id
        });

        assert.ok(org1.id.startsWith('org_'));
        assert.equal(org1.name, 'Acme QA Labs');
        assert.ok(org1.slug.startsWith('acme-qa-labs-'));
        assert.equal(org1.ownerId, ownerUser.id);
        assert.equal(org1.status, 'active');

        // Verify member record
        const member = await supabaseService.getOrgMember(org1.id, ownerUser.id);
        assert.ok(member);
        assert.equal(member.role, 'owner');
        assert.equal(member.status, 'active');
    });

    let pendingInvitation;

    await t.test('3. Member Invitation: Generates secure token with 7-day expiration', async () => {
        pendingInvitation = await supabaseService.createOrgInvitation({
            orgId: org1.id,
            email: memberUser.email,
            role: 'qa_engineer',
            invitedBy: ownerUser.id,
            message: 'Welcome to the QA automation squad!'
        });

        assert.ok(pendingInvitation.id.startsWith('inv_'));
        assert.equal(pendingInvitation.email, memberUser.email);
        assert.equal(pendingInvitation.role, 'qa_engineer');
        assert.equal(pendingInvitation.token.length, 64, 'Token must be high-entropy hex string');
        assert.equal(pendingInvitation.status, 'pending');

        const now = Date.now();
        const expTime = new Date(pendingInvitation.expiresAt).getTime();
        const diffDays = Math.round((expTime - now) / (1000 * 60 * 60 * 24));
        assert.equal(diffDays, 7, 'Expiration must be 7 days');
    });

    await t.test('4. Duplicate Invitation Prevention: Blocks duplicate active invites for same email', async () => {
        await assert.rejects(async () => {
            await supabaseService.createOrgInvitation({
                orgId: org1.id,
                email: memberUser.email,
                role: 'admin',
                invitedBy: ownerUser.id
            });
        }, /An active pending invitation for .* already exists/);
    });

    await t.test('5. Invitation Acceptance: Adds user as active member with designated role', async () => {
        const acceptedMember = await supabaseService.acceptOrgInvitation(
            pendingInvitation.token,
            memberUser.id,
            memberUser.email
        );

        assert.equal(acceptedMember.userId, memberUser.id);
        assert.equal(acceptedMember.role, 'qa_engineer');
        assert.equal(acceptedMember.status, 'active');

        // Verify invitation state updated
        const inv = await supabaseService.getInvitationByToken(pendingInvitation.token);
        assert.equal(inv.status, 'accepted');

        // Verify member list includes new member
        const members = await supabaseService.getOrgMembers(org1.id);
        assert.equal(members.length, 2);
    });

    await t.test('6. Member Management & Last Owner Protection: Cannot demote or remove the last owner', async () => {
        // Demoting owner when only 1 owner exists must fail
        await assert.rejects(async () => {
            await supabaseService.updateOrgMemberRole(org1.id, ownerUser.id, 'admin');
        }, /Cannot demote the last organization owner/);

        // Removing owner when only 1 owner exists must fail
        await assert.rejects(async () => {
            await supabaseService.removeOrgMember(org1.id, ownerUser.id);
        }, /Cannot remove the last organization owner/);

        // Promoting member to QA Manager succeeds
        const updated = await supabaseService.updateOrgMemberRole(org1.id, memberUser.id, 'qa_manager');
        assert.equal(updated.role, 'qa_manager');
    });

    await t.test('7. Ownership Transfer: Promotes new owner and demotes previous owner to admin', async () => {
        const transferred = await supabaseService.transferOrgOwnership(org1.id, memberUser.id, ownerUser.id);
        assert.equal(transferred.ownerId, memberUser.id);

        const newOwnerMem = await supabaseService.getOrgMember(org1.id, memberUser.id);
        assert.equal(newOwnerMem.role, 'owner');

        const prevOwnerMem = await supabaseService.getOrgMember(org1.id, ownerUser.id);
        assert.equal(prevOwnerMem.role, 'admin');

        // Transfer back to Sarah Owner
        await supabaseService.transferOrgOwnership(org1.id, ownerUser.id, memberUser.id);
    });

    await t.test('8. Organization Workspaces: Creates workspace within org and toggles archive status', async () => {
        const ws = await supabaseService.createOrgWorkspace(org1.id, {
            name: 'Billing & Checkout QA',
            description: 'E2E checkout test cases and Playwright suites',
            ownerId: ownerUser.id,
            visibility: 'organization'
        });

        assert.ok(ws.id.startsWith('ws_'));
        assert.equal(ws.organizationId, org1.id);
        assert.equal(ws.isArchived, false);

        // Archive workspace
        const archived = await supabaseService.archiveWorkspace(ws.id, true);
        assert.equal(archived.isArchived, true);

        // Listing non-archived does not include it
        const activeWorkspaces = await supabaseService.getOrgWorkspaces(org1.id, false);
        assert.ok(!activeWorkspaces.some(w => w.id === ws.id));

        // Listing all workspaces includes it
        const allWorkspaces = await supabaseService.getOrgWorkspaces(org1.id, true);
        assert.ok(allWorkspaces.some(w => w.id === ws.id));

        // Unarchive
        await supabaseService.archiveWorkspace(ws.id, false);
    });

    await t.test('9. Tenant Isolation & RBAC Middleware: Blocks unauthorized access to foreign org', async () => {
        const mockRes = () => {
            const res = {
                statusCode: 200,
                body: null,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    this.body = payload;
                    return this;
                }
            };
            return res;
        };

        let nextCalled = false;
        const next = () => { nextCalled = true; };

        // Foreign user attempts to access Org 1
        const reqForeign = {
            user: foreignUser,
            params: { orgId: org1.id }
        };
        const resForeign = mockRes();
        await requireOrgAccess(reqForeign, resForeign, next);

        assert.equal(resForeign.statusCode, 403);
        assert.equal(resForeign.body.code, 'FORBIDDEN');
        assert.equal(nextCalled, false);

        // Authorized owner user accesses Org 1
        nextCalled = false;
        const reqOwner = {
            user: ownerUser,
            params: { orgId: org1.id }
        };
        const resOwner = mockRes();
        await requireOrgAccess(reqOwner, resOwner, next);

        assert.equal(nextCalled, true);
        assert.equal(reqOwner.org.id, org1.id);
        assert.equal(reqOwner.orgRole, 'owner');
    });

    await t.test('10. Organization Audit Trail: Records chronological audit events with metadata', async () => {
        const logs = await supabaseService.getOrgAuditLogs(org1.id);
        assert.ok(Array.isArray(logs));
        assert.ok(logs.length >= 4);

        const actions = logs.map(l => l.action);
        assert.ok(actions.includes('organization.created'));
        assert.ok(actions.includes('member.invited'));
        assert.ok(actions.includes('invitation.accepted'));
        assert.ok(actions.includes('workspace.created'));
    });

    await t.test('11. Backward Compatibility: Auto-provisions organization for existing user workspaces', async () => {
        const legacyUserId = 'usr_legacy_' + Date.now();
        // Legacy workspace created directly without organizationId
        const legacyWs = {
            id: 'ws_legacy_' + Date.now(),
            name: 'Legacy Projects',
            ownerId: legacyUserId,
            organizationId: null
        };
        supabaseService.inMemoryWorkspaces.set(legacyWs.id, legacyWs);

        // Ensure user organization is called
        const userOrgs = await supabaseService.getUserOrganizations(legacyUserId, 'Legacy Engineer');
        assert.ok(userOrgs.length >= 1, 'Default organization must be provisioned');
        assert.equal(userOrgs[0].ownerId, legacyUserId);

        // Verify legacy workspace was automatically linked
        const updatedLegacyWs = supabaseService.inMemoryWorkspaces.get(legacyWs.id);
        assert.equal(updatedLegacyWs.organizationId, userOrgs[0].id);
    });

    await t.test('12. Controller REST Endpoints: Handles organization operations cleanly', async () => {
        const mockRes = () => {
            const res = {
                statusCode: 200,
                body: null,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    this.body = payload;
                    return this;
                }
            };
            return res;
        };

        // Test GET /organizations
        const reqList = { user: ownerUser };
        const resList = mockRes();
        await orgController.getUserOrganizations(reqList, resList);
        assert.equal(resList.statusCode, 200);
        assert.ok(resList.body.data.length >= 1);

        // Test GET /organizations/:id
        const reqDetails = { org: org1, orgRole: 'owner' };
        const resDetails = mockRes();
        await orgController.getOrganizationDetails(reqDetails, resDetails);
        assert.equal(resDetails.statusCode, 200);
        assert.equal(resDetails.body.data.memberCount >= 2, true);

        // Test GET /organizations/:id/members
        const reqMembers = { org: org1 };
        const resMembers = mockRes();
        await orgController.listMembers(reqMembers, resMembers);
        assert.equal(resMembers.statusCode, 200);
        assert.ok(resMembers.body.data.some(m => m.userId === memberUser.id));

        // Test GET /organizations/:id/activity
        const reqActivity = { org: org1, query: {} };
        const resActivity = mockRes();
        await orgController.getActivity(reqActivity, resActivity);
        assert.equal(resActivity.statusCode, 200);
        assert.ok(resActivity.body.data.length >= 1);
    });
});

