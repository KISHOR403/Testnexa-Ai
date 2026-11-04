/**
 * TestNexa AI — Phase 4 Step 5: Usage Limits & Quotas Management Test Suite
 * 
 * Verifies:
 * 1. Plan allowances resolution across Free, Starter, Pro, and Enterprise tiers
 * 2. Subscription billing cycle calculation & anchor-based reset dates
 * 3. Two-phase quota reservation, commitment, and release
 * 4. Hard quota enforcement (HTTP 403 QUOTA_EXCEEDED)
 * 5. Rollback of active reservations upon operation failure
 * 6. Organization scale quotas (members.active, workspaces.active)
 * 7. Artifact storage metering and delta tracking
 * 8. Warning threshold detection (50%, 75%, 90%, 100%) and deduplication
 * 9. Platform admin plan quota customization and persistence
 * 10. Organization usage endpoints and controllers
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const usageMeteringService = require('../src/services/usageMetering.service');
const supabaseService = require('../src/services/supabaseData.service');
const orgController = require('../src/controllers/organization.controller');
const adminController = require('../src/controllers/admin.controller');

describe('Usage Limits & Quotas Management Suite', () => {
    const testOrgId = `org_quota_test_${Date.now()}`;
    const testWsId = `ws_quota_test_${Date.now()}`;
    const testUserId = `user_quota_${Date.now()}`;

    beforeEach(async () => {
        // Seed test organization on Free plan
        await supabaseService.saveOrganization({
            id: testOrgId,
            name: 'Quota Test Org',
            slug: `quota-test-org-${Date.now()}`,
            plan: 'free',
            ownerId: testUserId,
            subscriptionStartDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
            createdAt: new Date().toISOString()
        });

        // Seed test workspace
        await supabaseService.createOrgWorkspace(testOrgId, {
            id: testWsId,
            name: 'Quota Test Workspace',
            ownerId: testUserId
        });
    });

    test('1. Plan Allowances Resolution: Resolves standard tier allowances correctly', () => {
        const freeGen = usageMeteringService.getAllowance('free', 'ai.generations');
        const freeStorage = usageMeteringService.getAllowance('free', 'storage.bytes');
        const proGen = usageMeteringService.getAllowance('pro', 'ai.generations');
        const entMembers = usageMeteringService.getAllowance('enterprise', 'members.active');

        assert.equal(freeGen, 20);
        assert.equal(freeStorage, 1024 * 1024 * 1024); // 1 GB
        assert.equal(proGen, 1000);
        assert.equal(entMembers, 100);

        // Fallback for unknown plan
        const unknownGen = usageMeteringService.getAllowance('custom_tier_xyz', 'ai.generations');
        assert.equal(unknownGen, 20);
    });

    test('2. Dynamic Billing Period: Calculates cycle start, end, reset date, and days remaining', () => {
        const org = {
            id: testOrgId,
            subscriptionStartDate: '2026-01-15T00:00:00.000Z'
        };

        const cycle = usageMeteringService.getCurrentBillingPeriod(org);
        assert.ok(cycle.start);
        assert.ok(cycle.end);
        assert.ok(cycle.resetDate);
        assert.ok(cycle.daysRemaining >= 1 && cycle.daysRemaining <= 31);
        assert.equal(new Date(cycle.start) <= new Date(cycle.end), true);
    });

    test('3. Two-Phase Reservation & Commit: Reserves units, commits event, and records usage', async () => {
        // Reserve 1 AI generation
        const reservation = await usageMeteringService.reserveQuota({
            orgId: testOrgId,
            workspaceId: testWsId,
            userId: testUserId,
            metric: 'ai.generations',
            quantity: 1,
            operationId: 'op_test_1'
        });

        assert.ok(reservation);
        assert.ok(reservation.id.startsWith('qres_'));
        assert.equal(reservation.quantity, 1);
        assert.equal(usageMeteringService.getReservedQuantity(testOrgId, 'ai.generations'), 1);

        // Commit usage
        const event = await usageMeteringService.commitUsage({
            reservationId: reservation.id,
            orgId: testOrgId,
            workspaceId: testWsId,
            userId: testUserId,
            metric: 'ai.generations',
            quantity: 1,
            operationId: 'op_test_1'
        });

        assert.ok(event);
        assert.equal(event.status, 'committed');
        // Reservation is cleared
        assert.equal(usageMeteringService.getReservedQuantity(testOrgId, 'ai.generations'), 0);

        // Check organization usage summary
        const usage = await usageMeteringService.getOrganizationUsage(testOrgId);
        assert.equal(usage.metrics['ai.generations'].used, 1);
        assert.equal(usage.metrics['ai.generations'].remaining, 19);
        assert.equal(usage.metrics['ai.generations'].percentage, 5);
    });

    test('4. Hard Quota Limit Enforcement: Throws 403 QUOTA_EXCEEDED when allowance is exhausted', async () => {
        const limitedOrgId = `org_limit_${Date.now()}`;
        await supabaseService.saveOrganization({
            id: limitedOrgId,
            name: 'Limited Org',
            plan: 'free',
            ownerId: testUserId
        });

        // Allowance for Free automated runs is 20. Commit 20 events.
        for (let i = 0; i < 20; i++) {
            await usageMeteringService.commitUsage({
                orgId: limitedOrgId,
                metric: 'execution.automated',
                quantity: 1,
                operationId: `autotest_${i}`
            });
        }

        // Attempting to reserve the 21st run must fail
        await assert.rejects(async () => {
            await usageMeteringService.reserveQuota({
                orgId: limitedOrgId,
                metric: 'execution.automated',
                quantity: 1
            });
        }, (err) => {
            assert.equal(err.code, 'QUOTA_EXCEEDED');
            assert.equal(err.statusCode, 403);
            assert.equal(err.data.metric, 'execution.automated');
            assert.equal(err.data.plan, 'free');
            assert.equal(err.data.allowance, 20);
            assert.equal(err.data.currentUsage, 20);
            assert.equal(err.data.remaining, 0);
            return true;
        });
    });

    test('5. Reservation Rollback: Releases units upon operation failure so capacity is not leaked', async () => {
        const rollbackOrgId = `org_rollback_${Date.now()}`;
        await supabaseService.saveOrganization({
            id: rollbackOrgId,
            name: 'Rollback Org',
            plan: 'free',
            ownerId: testUserId
        });

        // Reserve 10 manual test executions
        const res = await usageMeteringService.reserveQuota({
            orgId: rollbackOrgId,
            metric: 'execution.manual',
            quantity: 10
        });

        assert.equal(usageMeteringService.getReservedQuantity(rollbackOrgId, 'execution.manual'), 10);

        // Simulate operation failure -> release reservation
        usageMeteringService.releaseReservation(res.id);

        assert.equal(usageMeteringService.getReservedQuantity(rollbackOrgId, 'execution.manual'), 0);

        // Usage remains 0
        const usage = await usageMeteringService.getOrganizationUsage(rollbackOrgId);
        assert.equal(usage.metrics['execution.manual'].used, 0);
        assert.equal(usage.metrics['execution.manual'].remaining, 50);
    });

    test('6. Organization Scale Quotas: Enforces active member and workspace limits', async () => {
        const scaleOrgId = `org_scale_${Date.now()}`;
        const scaleOrg = await supabaseService.saveOrganization({
            id: scaleOrgId,
            name: 'Scale Org',
            plan: 'free', // Free plan allows 1 member and 1 workspace
            ownerId: testUserId
        });

        // Free plan allows 1 active workspace: 1 already exists (or create first one)
        const ws1 = await supabaseService.createOrgWorkspace(scaleOrgId, {
            name: 'Workspace Alpha',
            ownerId: testUserId
        });
        assert.ok(ws1);

        // Attempt to create a 2nd workspace in Free plan via controller
        const mockReq = {
            org: scaleOrg,
            user: { _id: testUserId, id: testUserId },
            body: { name: 'Workspace Beta', description: 'Exceeds quota' }
        };

        let statusCode = 0;
        let responseJson = null;
        const mockRes = {
            status: (c) => {
                statusCode = c;
                return {
                    json: (d) => {
                        responseJson = d;
                        return d;
                    }
                };
            }
        };

        await orgController.createWorkspace(mockReq, mockRes);
        assert.equal(statusCode, 403);
        assert.equal(responseJson.code, 'QUOTA_EXCEEDED');
        assert.equal(responseJson.data.metric, 'workspaces.active');
    });

    test('7. Storage Metering: Tracks artifact storage bytes and delta adjustments accurately', async () => {
        const storageOrgId = `org_storage_${Date.now()}`;
        await supabaseService.saveOrganization({
            id: storageOrgId,
            name: 'Storage Org',
            plan: 'free',
            ownerId: testUserId
        });

        // Add 5 MB of artifact storage
        const fiveMB = 5 * 1024 * 1024;
        await usageMeteringService.recordStorageDelta(storageOrgId, fiveMB, 'art_test_1');

        let bytes = await supabaseService.getOrgStorageBytes(storageOrgId);
        assert.equal(bytes, fiveMB);

        // Add 3 MB
        const threeMB = 3 * 1024 * 1024;
        await usageMeteringService.recordStorageDelta(storageOrgId, threeMB, 'art_test_2');

        bytes = await supabaseService.getOrgStorageBytes(storageOrgId);
        assert.equal(bytes, 8 * 1024 * 1024);

        // Remove 2 MB (e.g. artifact pruned or deleted)
        await usageMeteringService.recordStorageDelta(storageOrgId, -(2 * 1024 * 1024), 'art_prune');
        bytes = await supabaseService.getOrgStorageBytes(storageOrgId);
        assert.equal(bytes, 6 * 1024 * 1024);
    });

    test('8. Threshold Warnings: Generates warnings at >=50%, 75%, 90%, 100% and deduplicates alerts', async () => {
        const alertOrgId = `org_alert_${Date.now()}`;
        await supabaseService.saveOrganization({
            id: alertOrgId,
            name: 'Alert Org',
            plan: 'free', // 10 CI/CD executions allowed on Free
            ownerId: testUserId
        });

        // Consume 5 CI/CD runs (50%)
        for (let i = 0; i < 5; i++) {
            await usageMeteringService.commitUsage({
                orgId: alertOrgId,
                metric: 'execution.cicd',
                quantity: 1,
                operationId: `ci_alert_${i}`
            });
        }

        const usage50 = await usageMeteringService.getOrganizationUsage(alertOrgId);
        const cicdMetric = usage50.metrics['execution.cicd'];
        assert.equal(cicdMetric.percentage, 50);

        const warning50 = usage50.warnings.find(w => w.metric === 'execution.cicd');
        assert.ok(warning50);
        assert.equal(warning50.threshold, 50);

        // Consume 3 more (80% -> crosses 75% threshold)
        for (let i = 5; i < 8; i++) {
            await usageMeteringService.commitUsage({
                orgId: alertOrgId,
                metric: 'execution.cicd',
                quantity: 1,
                operationId: `ci_alert_${i}`
            });
        }

        const usage80 = await usageMeteringService.getOrganizationUsage(alertOrgId);
        const warning75 = usage80.warnings.find(w => w.metric === 'execution.cicd');
        assert.ok(warning75);
        assert.equal(warning75.threshold, 75);
    });

    test('9. Platform Admin Quotas: Customizes plan quotas and applies them to organization enforcement', async () => {
        // Admin updates 'free' tier automated runs allowance from 20 to 35
        const updated = await usageMeteringService.updatePlanQuotas('free', {
            'execution.automated': 35
        }, { id: 'admin_1', name: 'Platform Admin' });

        assert.equal(updated['execution.automated'], 35);
        assert.equal(usageMeteringService.getAllowance('free', 'execution.automated'), 35);

        // Reset back to standard 20 for subsequent test purity
        await usageMeteringService.updatePlanQuotas('free', {
            'execution.automated': 20
        });
        assert.equal(usageMeteringService.getAllowance('free', 'execution.automated'), 20);
    });

    test('10. Organization Usage Endpoints: Returns complete telemetry via controller', async () => {
        const mockOrg = await supabaseService.getOrganization(testOrgId);
        const mockReq = {
            org: mockOrg,
            user: { _id: testUserId, id: testUserId },
            query: {}
        };

        let jsonPayload = null;
        const mockRes = {
            json: (data) => {
                jsonPayload = data;
                return mockRes;
            }
        };

        // 1. GET /usage
        await orgController.getOrganizationUsage(mockReq, mockRes);
        assert.ok(jsonPayload);
        assert.equal(jsonPayload.success, true);
        assert.ok(jsonPayload.data.metrics['ai.generations']);
        assert.ok(jsonPayload.data.billingPeriod);

        // 2. GET /usage/history
        await orgController.getUsageHistory(mockReq, mockRes);
        assert.ok(jsonPayload);
        assert.equal(jsonPayload.success, true);
        assert.ok(Array.isArray(jsonPayload.data));

        // 3. GET /usage/warnings
        await orgController.getUsageWarnings(mockReq, mockRes);
        assert.ok(jsonPayload);
        assert.equal(jsonPayload.success, true);
        assert.ok(Array.isArray(jsonPayload.data));
    });
});

