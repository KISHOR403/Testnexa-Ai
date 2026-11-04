/**
 * TestNexa AI — Phase 4 Step 3: Centralized Audit Logs & Activity History Test Suite
 * 
 * Verifies:
 * 1. Structured event generation with consistent schema & actor attribution
 * 2. Sensitive data redaction (passwords, tokens, API keys)
 * 3. Before/After diff calculation
 * 4. Idempotency & duplicate event rejection
 * 5. Multi-tenant organization isolation (blocks cross-org log retrieval)
 * 6. Scoped filtering by workspace, action category, outcome, source, and search
 * 7. RBAC permissions (audit.view, audit.export, role denial)
 * 8. Safe CSV export serialization & spreadsheet formula injection prevention
 * 9. Self-recording of export actions in audit trail
 * 10. Contextual resource activity history
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const auditService = require('../src/services/auditService');
const supabaseService = require('../src/services/supabaseData.service');
const { hasOrgPermission, ROLES } = require('../src/utils/rbac');
const orgController = require('../src/controllers/organization.controller');

describe('Audit Logs & Activity History Suite', () => {
    const testOrgId = `org_test_${Date.now()}`;
    const otherOrgId = `org_other_${Date.now()}`;
    const testWsId = `ws_test_${Date.now()}`;
    const actorUser = {
        id: 'usr_lead_qa_1',
        _id: 'usr_lead_qa_1',
        name: 'Sarah Connor',
        displayName: 'Sarah Connor',
        email: 'sarah@testnexa.ai'
    };

    beforeEach(() => {
        // Clear in-memory audit logs between runs for test determinism
        supabaseService.inMemoryAuditEvents.clear();
        supabaseService.inMemoryOrgAuditLogs = [];
    });

    test('1. Event Structure: Logs event with standardized schema and UTC timestamp', async () => {
        const event = await auditService.log({
            orgId: testOrgId,
            workspaceId: testWsId,
            actorId: actorUser.id,
            actorDisplayName: actorUser.name,
            actorEmail: actorUser.email,
            actorType: 'User',
            action: 'suite.created',
            resourceType: 'suite',
            resourceId: 'suite_999',
            resourceDisplayName: 'Checkout Regression Suite',
            outcome: 'Success',
            source: 'Web App',
            metadata: { testCaseCount: 15 }
        });

        assert.ok(event);
        assert.ok(event.id.startsWith('aevt_'));
        assert.equal(event.orgId, testOrgId);
        assert.equal(event.workspaceId, testWsId);
        assert.equal(event.actorId, actorUser.id);
        assert.equal(event.actorDisplayName, 'Sarah Connor');
        assert.equal(event.actorEmail, 'sarah@testnexa.ai');
        assert.equal(event.action, 'suite.created');
        assert.equal(event.resourceType, 'suite');
        assert.equal(event.resourceId, 'suite_999');
        assert.equal(event.outcome, 'Success');
        assert.equal(event.source, 'Web App');
        assert.ok(event.timestamp);
        assert.ok(!isNaN(new Date(event.timestamp).getTime()));
    });

    test('2. Sensitive Data Redaction: Never logs passwords, API keys, bearer tokens, or secrets', async () => {
        const event = await auditService.log({
            orgId: testOrgId,
            actorId: actorUser.id,
            action: 'integration.connected',
            resourceType: 'integration',
            resourceId: 'github',
            metadata: {
                apiKey: 'ak_live_very_secret_key_12345',
                bearerToken: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                password: 'SuperSecretPassword!@#123',
                clientSecret: 'secret_hex_999000111',
                safeParam: 'public_config'
            },
            before: {
                secretToken: 'old_secret_value',
                displayName: 'Old Name'
            },
            after: {
                secretToken: 'new_secret_value',
                displayName: 'New Name'
            }
        });

        assert.equal(event.metadata.apiKey, '[REDACTED]');
        assert.equal(event.metadata.bearerToken, '[REDACTED]');
        assert.equal(event.metadata.password, '[REDACTED]');
        assert.equal(event.metadata.clientSecret, '[REDACTED]');
        assert.equal(event.metadata.safeParam, 'public_config');

        // Check before/after diffs are also redacted
        assert.ok(event.changes);
        assert.equal(event.changes.displayName.before, 'Old Name');
        assert.equal(event.changes.displayName.after, 'New Name');
        assert.equal(event.changes.secretToken.before, '[REDACTED]');
        assert.equal(event.changes.secretToken.after, '[REDACTED]');
    });

    test('3. Before & After Diff: Automatically computes field-level differences', async () => {
        const event = await auditService.log({
            orgId: testOrgId,
            actorId: actorUser.id,
            action: 'workspace.updated',
            resourceType: 'workspace',
            resourceId: testWsId,
            before: { name: 'Alpha Suite', visibility: 'private', memberCount: 3 },
            after: { name: 'Alpha Suite Pro', visibility: 'organization', memberCount: 3 }
        });

        assert.ok(event.changes);
        // name and visibility changed
        assert.deepEqual(event.changes.name, { before: 'Alpha Suite', after: 'Alpha Suite Pro' });
        assert.deepEqual(event.changes.visibility, { before: 'private', after: 'organization' });
        // memberCount did not change, so it must not be in diff
        assert.equal(event.changes.memberCount, undefined);
    });

    test('4. Idempotency: Rejects duplicate event creation when retried with same key', async () => {
        const idemKey = `idem_${crypto.randomBytes(6).toString('hex')}`;

        const event1 = await auditService.log({
            orgId: testOrgId,
            actorId: actorUser.id,
            action: 'execution.started',
            resourceType: 'execution',
            resourceId: 'run_101',
            idempotencyKey: idemKey
        });

        const event2 = await auditService.log({
            orgId: testOrgId,
            actorId: actorUser.id,
            action: 'execution.started',
            resourceType: 'execution',
            resourceId: 'run_101',
            idempotencyKey: idemKey
        });

        assert.ok(event1);
        assert.ok(event2);
        assert.equal(event1.id, event2.id); // Same event returned
        assert.equal(supabaseService.inMemoryAuditEvents.size, 1);
    });

    test('5. Multi-Tenant Organization Isolation: Blocks cross-tenant event access', async () => {
        // Record event for Org A
        await auditService.log({
            orgId: testOrgId,
            actorId: 'usr_orgA',
            action: 'testcase.created',
            resourceType: 'testcase',
            resourceId: 'case_A1'
        });

        // Record event for Org B
        const evtB = await auditService.log({
            orgId: otherOrgId,
            actorId: 'usr_orgB',
            action: 'testcase.created',
            resourceType: 'testcase',
            resourceId: 'case_B1'
        });

        // Query Org A events
        const resA = await auditService.getEvents(testOrgId);
        assert.equal(resA.total, 1);
        assert.equal(resA.events[0].resourceId, 'case_A1');

        // Direct ID lookup across organization boundary returns null
        const crossLookup = await auditService.getEventById(testOrgId, evtB.id);
        assert.equal(crossLookup, null, 'Must not return event belonging to a different organization');
    });

    test('6. Filtering & Searching: Accurately filters by category, outcome, workspace, and search term', async () => {
        await auditService.log({
            orgId: testOrgId,
            workspaceId: 'ws_billing',
            actorDisplayName: 'Alice Engineer',
            action: 'execution.started',
            resourceType: 'execution',
            resourceDisplayName: 'Stripe Billing E2E',
            outcome: 'Success',
            source: 'Web App'
        });

        await auditService.log({
            orgId: testOrgId,
            workspaceId: 'ws_auth',
            actorDisplayName: 'Bob Security',
            action: 'auth.failed_login',
            resourceType: 'auth',
            resourceDisplayName: 'Failed Login Attempt',
            outcome: 'Failure',
            source: 'API'
        });

        await auditService.log({
            orgId: testOrgId,
            workspaceId: 'ws_auth',
            actorDisplayName: 'Charlie Admin',
            action: 'member.role_changed',
            resourceType: 'member',
            resourceDisplayName: 'Promote Dave to Admin',
            outcome: 'Success',
            source: 'Web App'
        });

        // Filter by workspace
        const wsFiltered = await auditService.getEvents(testOrgId, { workspaceId: 'ws_auth' });
        assert.equal(wsFiltered.total, 2);

        // Filter by outcome
        const failedFiltered = await auditService.getEvents(testOrgId, { outcome: 'Failure' });
        assert.equal(failedFiltered.total, 1);
        assert.equal(failedFiltered.events[0].action, 'auth.failed_login');

        // Search by actor
        const searchAlice = await auditService.getEvents(testOrgId, { search: 'Alice' });
        assert.equal(searchAlice.total, 1);
        assert.equal(searchAlice.events[0].actorDisplayName, 'Alice Engineer');

        // Search by resource
        const searchStripe = await auditService.getEvents(testOrgId, { search: 'Stripe' });
        assert.equal(searchStripe.total, 1);
        assert.equal(searchStripe.events[0].resourceDisplayName, 'Stripe Billing E2E');
    });

    test('7. RBAC Permissions: Enforces audit.view and audit.export access', () => {
        // Owner and Admin have both view & export
        assert.equal(hasOrgPermission(ROLES.OWNER, 'audit.view'), true);
        assert.equal(hasOrgPermission(ROLES.OWNER, 'audit.export'), true);
        assert.equal(hasOrgPermission(ROLES.ADMIN, 'audit.view'), true);
        assert.equal(hasOrgPermission(ROLES.ADMIN, 'audit.export'), true);

        // QA Manager has view, but NOT export
        assert.equal(hasOrgPermission(ROLES.QA_MANAGER, 'audit.view'), true);
        assert.equal(hasOrgPermission(ROLES.QA_MANAGER, 'audit.export'), false);

        // QA Engineer and Viewer have neither
        assert.equal(hasOrgPermission(ROLES.QA_ENGINEER, 'audit.view'), false);
        assert.equal(hasOrgPermission(ROLES.QA_ENGINEER, 'audit.export'), false);
        assert.equal(hasOrgPermission(ROLES.VIEWER, 'audit.view'), false);
        assert.equal(hasOrgPermission(ROLES.VIEWER, 'audit.export'), false);
    });

    test('8. Safe CSV Export: Serializes records and neutralizes spreadsheet formula injection', async () => {
        // Log event with dangerous spreadsheet formulas (=, +, -, @)
        await auditService.log({
            orgId: testOrgId,
            actorDisplayName: '=cmd|"/C calc"!A0',
            action: '+SUM(1,2)',
            resourceType: 'project',
            resourceDisplayName: '@dangerous_formula',
            outcome: 'Success',
            source: 'Web App'
        });

        const csv = await auditService.exportToCsv(testOrgId);
        assert.ok(csv.includes('Event ID,Timestamp (UTC),Actor Name'));

        // Formula injection prefixes must be neutralized with a leading single quote (')
        assert.ok(csv.includes("'=cmd|\"\"/C calc\"\"!A0"), 'Equal sign formula must be prepended with single quote');
        assert.ok(csv.includes("'+SUM(1,2)"), 'Plus sign formula must be prepended with single quote');
        assert.ok(csv.includes("'@dangerous_formula"), 'At sign formula must be prepended with single quote');
    });

    test('9. Export Self-Auditing: Exporting audit logs records an audit.exported event', async () => {
        // Mock req and res for controller export
        let sentData = '';
        let headersSent = {};
        const mockReq = {
            org: { id: testOrgId, name: 'Test Org' },
            orgRole: 'owner',
            user: actorUser,
            query: { outcome: 'Success' },
            headers: {}
        };
        const mockRes = {
            setHeader: (k, v) => { headersSent[k] = v; },
            status: () => mockRes,
            send: (data) => { sentData = data; return mockRes; },
            json: (data) => { sentData = data; return mockRes; }
        };

        await orgController.exportAuditLogs(mockReq, mockRes);
        assert.ok(sentData);
        assert.equal(headersSent['Content-Type'], 'text/csv; charset=utf-8');

        // Check that an 'audit.exported' event was logged
        const res = await auditService.getEvents(testOrgId, { action: 'audit.exported' });
        assert.equal(res.total, 1);
        assert.equal(res.events[0].action, 'audit.exported');
        assert.equal(res.events[0].actorId, actorUser.id);
    });

    test('10. Contextual Resource Activity History: Retrieves events for individual resource', async () => {
        const testCaseId = 'tc_order_checkout_01';

        await auditService.log({
            orgId: testOrgId,
            action: 'testcase.created',
            resourceType: 'testcase',
            resourceId: testCaseId,
            resourceDisplayName: 'Order Checkout Test',
            actorDisplayName: 'Dev Tester'
        });

        await auditService.log({
            orgId: testOrgId,
            action: 'testcase.edited',
            resourceType: 'testcase',
            resourceId: testCaseId,
            resourceDisplayName: 'Order Checkout Test',
            before: { timeout: 3000 },
            after: { timeout: 5000 },
            actorDisplayName: 'Senior QA'
        });

        await auditService.log({
            orgId: testOrgId,
            action: 'testcase.created',
            resourceType: 'testcase',
            resourceId: 'tc_other_99',
            actorDisplayName: 'Dev Tester'
        });

        const history = await auditService.getResourceActivity('testcase', testCaseId, { orgId: testOrgId });
        assert.equal(history.length, 2);
        assert.equal(history[0].action, 'testcase.edited'); // newest first
        assert.equal(history[1].action, 'testcase.created');
        assert.deepEqual(history[0].changes.timeout, { before: 3000, after: 5000 });
    });
});
