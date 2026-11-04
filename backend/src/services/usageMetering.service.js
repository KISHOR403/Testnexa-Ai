/**
 * TestNexa AI — Centralized Usage Metering & Quota Enforcement Service
 * 
 * Manages:
 * - Deterministic, server-side usage tracking across AI, executions, storage, and org scale
 * - Plan-based quota allowances (Free, Starter, Pro, Enterprise)
 * - Atomic two-phase quota reservation and commitment (reserve -> commit / release)
 * - Subscription billing period calculation & usage reset dates
 * - Threshold-based usage warnings (50%, 75%, 90%, 100%) with deduplication
 * - Real-time artifact storage metering
 * - Admin plan quota customization & persistence
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const supabaseService = require('./supabaseData.service');
const auditService = require('./auditService');

/**
 * Standard illustrative plan allowances across metric dimensions
 */
const DEFAULT_PLAN_ALLOWANCES = {
    free: {
        'ai.generations': 20,
        'ai.failure_analysis': 10,
        'execution.manual': 50,
        'execution.automated': 20,
        'execution.cicd': 10,
        'members.active': 1,
        'workspaces.active': 1,
        'storage.bytes': 1 * 1024 * 1024 * 1024 // 1 GB
    },
    starter: {
        'ai.generations': 200,
        'ai.failure_analysis': 100,
        'execution.manual': 500,
        'execution.automated': 200,
        'execution.cicd': 100,
        'members.active': 5,
        'workspaces.active': 3,
        'storage.bytes': 10 * 1024 * 1024 * 1024 // 10 GB
    },
    pro: {
        'ai.generations': 1000,
        'ai.failure_analysis': 500,
        'execution.manual': 2500,
        'execution.automated': 1000,
        'execution.cicd': 500,
        'members.active': 20,
        'workspaces.active': 10,
        'storage.bytes': 50 * 1024 * 1024 * 1024 // 50 GB
    },
    enterprise: {
        'ai.generations': 10000,
        'ai.failure_analysis': 5000,
        'execution.manual': 25000,
        'execution.automated': 10000,
        'execution.cicd': 5000,
        'members.active': 100,
        'workspaces.active': 50,
        'storage.bytes': 500 * 1024 * 1024 * 1024 // 500 GB
    }
};

const METRIC_METADATA = {
    'ai.generations': {
        name: 'AI Test Generations',
        category: 'AI',
        unit: 'count',
        type: 'consumable',
        warningThresholds: [0.5, 0.75, 0.9, 1.0]
    },
    'ai.failure_analysis': {
        name: 'AI Failure Analyses',
        category: 'AI',
        unit: 'count',
        type: 'consumable',
        warningThresholds: [0.5, 0.75, 0.9, 1.0]
    },
    'execution.manual': {
        name: 'Manual Test Executions',
        category: 'Testing',
        unit: 'count',
        type: 'consumable',
        warningThresholds: [0.5, 0.75, 0.9, 1.0]
    },
    'execution.automated': {
        name: 'Automated Playwright Executions',
        category: 'Testing',
        unit: 'count',
        type: 'consumable',
        warningThresholds: [0.5, 0.75, 0.9, 1.0]
    },
    'execution.cicd': {
        name: 'CI/CD Pipeline Executions',
        category: 'Testing',
        unit: 'count',
        type: 'consumable',
        warningThresholds: [0.5, 0.75, 0.9, 1.0]
    },
    'members.active': {
        name: 'Active Team Members',
        category: 'Organization',
        unit: 'count',
        type: 'gauge',
        warningThresholds: [0.75, 1.0]
    },
    'workspaces.active': {
        name: 'Active Workspaces',
        category: 'Organization',
        unit: 'count',
        type: 'gauge',
        warningThresholds: [0.75, 1.0]
    },
    'storage.bytes': {
        name: 'Artifact Storage',
        category: 'Storage',
        unit: 'bytes',
        type: 'gauge',
        warningThresholds: [0.5, 0.75, 0.9, 1.0]
    }
};

class UsageMeteringService {
    constructor() {
        this.reservations = new Map(); // reservationId -> reservation
        this.reservationTimeouts = new Map();
        this.planAllowances = JSON.parse(JSON.stringify(DEFAULT_PLAN_ALLOWANCES));
        this.deduplicatedAlerts = new Set(); // orgId:metric:threshold:periodStart
        this._initPlanQuotas();
    }

    async _initPlanQuotas() {
        try {
            const saved = await supabaseService.getPlanQuotas();
            if (saved && typeof saved === 'object') {
                this.planAllowances = { ...this.planAllowances, ...saved };
            }
        } catch (e) {
            // Ignore during startup or test runs
        }
    }

    /**
     * Calculates the active billing period based on organization subscription anchor
     */
    getCurrentBillingPeriod(org) {
        const now = new Date();
        const anchorDate = org?.subscriptionStartDate ? new Date(org.subscriptionStartDate) : (org?.createdAt ? new Date(org.createdAt) : now);
        const anchorDay = anchorDate.getUTCDate() || 1;

        // Current cycle start
        let start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), anchorDay, 0, 0, 0, 0));
        if (start.getTime() > now.getTime()) {
            // Anchor day hasn't occurred yet this month -> cycle started last month
            start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, anchorDay, 0, 0, 0, 0));
        }

        // Cycle end is next month's anchor day minus 1 ms
        let end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, anchorDay, 23, 59, 59, 999));
        end.setUTCDate(end.getUTCDate() - 1);

        const diffMs = end.getTime() - now.getTime();
        const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

        return {
            start: start.toISOString(),
            end: end.toISOString(),
            resetDate: end.toISOString(),
            daysRemaining
        };
    }

    /**
     * Resolves the configured quota allowance for a plan and metric
     */
    getAllowance(planId, metric) {
        const cleanPlan = (planId || 'free').toLowerCase();
        const plan = this.planAllowances[cleanPlan] || this.planAllowances.free;
        return plan[metric] !== undefined ? plan[metric] : (DEFAULT_PLAN_ALLOWANCES.free[metric] || 0);
    }

    /**
     * Sums currently reserved units for an org and metric
     */
    getReservedQuantity(orgId, metric) {
        let total = 0;
        const now = Date.now();
        for (const res of this.reservations.values()) {
            if (res.orgId === orgId && res.metric === metric && res.expiresAt > now) {
                total += res.quantity;
            }
        }
        return total;
    }

    /**
     * Retrieves comprehensive usage metrics, allowances, remaining, and percentages
     */
    async getOrganizationUsage(orgId) {
        if (!orgId) throw new Error('Organization ID is required');

        const org = await supabaseService.getOrganization(orgId);
        if (!org) throw new Error(`Organization ${orgId} not found`);

        const planId = (org.plan || 'free').toLowerCase();
        const billingPeriod = this.getCurrentBillingPeriod(org);

        // Fetch committed usage events for this billing period
        const periodEvents = await supabaseService.getUsageEvents(orgId, {
            startDate: billingPeriod.start,
            endDate: billingPeriod.end
        });

        // Compute consumable sums
        const consumableSums = {};
        for (const evt of periodEvents) {
            consumableSums[evt.metric] = (consumableSums[evt.metric] || 0) + Number(evt.quantity || 0);
        }

        // Compute gauge metrics (active members, active workspaces, actual storage bytes)
        const members = await supabaseService.getOrgMembers(orgId);
        const activeMembersCount = members.filter(m => m.status === 'active').length || 1;

        const workspaces = await supabaseService.getOrgWorkspaces(orgId, false);
        const activeWorkspacesCount = workspaces.filter(w => !w.isArchived).length || 1;

        // Calculate actual storage consumption
        const storageBytes = await supabaseService.getOrgStorageBytes(orgId);

        const metricsData = {};
        const warnings = [];

        for (const [metric, meta] of Object.entries(METRIC_METADATA)) {
            let used = 0;
            if (metric === 'members.active') {
                used = activeMembersCount;
            } else if (metric === 'workspaces.active') {
                used = activeWorkspacesCount;
            } else if (metric === 'storage.bytes') {
                used = storageBytes;
            } else {
                used = consumableSums[metric] || 0;
            }

            const reserved = meta.type === 'consumable' ? this.getReservedQuantity(orgId, metric) : 0;
            const allowance = this.getAllowance(planId, metric);
            const remaining = Math.max(0, allowance - (used + reserved));
            const percentage = allowance > 0 ? Math.min(100, Math.round(((used + reserved) / allowance) * 100)) : 0;

            metricsData[metric] = {
                metric,
                name: meta.name,
                category: meta.category,
                unit: meta.unit,
                type: meta.type,
                used,
                reserved,
                effectiveUsed: used + reserved,
                allowance,
                remaining,
                percentage,
                resetDate: meta.type === 'consumable' ? billingPeriod.resetDate : null
            };

            // Check warning alerts
            if (percentage >= 50) {
                const thresholdCrossed = meta.warningThresholds
                    .filter(t => (percentage / 100) >= t)
                    .pop(); // highest crossed threshold

                if (thresholdCrossed) {
                    const thresholdPct = Math.round(thresholdCrossed * 100);
                    warnings.push({
                        metric,
                        name: meta.name,
                        threshold: thresholdPct,
                        used,
                        allowance,
                        remaining,
                        resetDate: billingPeriod.resetDate,
                        message: `You have reached ${thresholdPct}% of your ${meta.name} allowance.`
                    });
                }
            }
        }

        return {
            orgId,
            plan: planId,
            billingInterval: org.billingInterval || 'monthly',
            billingPeriod,
            metrics: metricsData,
            warnings
        };
    }

    /**
     * Reserves quota prior to performing a metered operation
     * Prevents race conditions and double-spending across concurrent requests.
     */
    async reserveQuota({
        orgId,
        workspaceId = null,
        userId = null,
        metric,
        quantity = 1,
        operationId = null,
        ttlMs = 15 * 60 * 1000 // 15 minutes reservation timeout
    }) {
        if (!orgId || !metric) {
            throw new Error('orgId and metric are required for quota reservation');
        }

        const org = await supabaseService.getOrganization(orgId);
        if (!org) {
            throw new Error(`Organization ${orgId} not found`);
        }

        const planId = (org.plan || 'free').toLowerCase();
        const allowance = this.getAllowance(planId, metric);
        const billingPeriod = this.getCurrentBillingPeriod(org);

        // Calculate current usage
        let currentUsage = 0;
        const meta = METRIC_METADATA[metric] || {};

        if (meta.type === 'gauge') {
            if (metric === 'members.active') {
                const members = await supabaseService.getOrgMembers(orgId);
                currentUsage = members.filter(m => m.status === 'active').length;
            } else if (metric === 'workspaces.active') {
                const workspaces = await supabaseService.getOrgWorkspaces(orgId, false);
                currentUsage = workspaces.filter(w => !w.isArchived).length;
            } else if (metric === 'storage.bytes') {
                currentUsage = await supabaseService.getOrgStorageBytes(orgId);
            }
        } else {
            const periodEvents = await supabaseService.getUsageEvents(orgId, {
                metric,
                startDate: billingPeriod.start,
                endDate: billingPeriod.end
            });
            currentUsage = periodEvents.reduce((acc, e) => acc + Number(e.quantity || 0), 0);
        }

        const currentReserved = this.getReservedQuantity(orgId, metric);
        const projectedUsage = currentUsage + currentReserved + quantity;

        if (projectedUsage > allowance) {
            const err = new Error(`Quota limit reached for ${meta.name || metric}. (${currentUsage + currentReserved}/${allowance} ${meta.unit || 'units'} on ${planId.toUpperCase()} plan)`);
            err.code = 'QUOTA_EXCEEDED';
            err.statusCode = 403;
            err.data = {
                metric,
                metricName: meta.name || metric,
                plan: planId,
                currentUsage: currentUsage + currentReserved,
                allowance,
                remaining: Math.max(0, allowance - (currentUsage + currentReserved)),
                resetDate: meta.type === 'consumable' ? billingPeriod.resetDate : null,
                suggestedAction: 'Upgrade your subscription plan to unlock additional capacity.'
            };
            throw err;
        }

        // Reservation granted
        const reservationId = `qres_${crypto.randomBytes(8).toString('hex')}`;
        const reservation = {
            id: reservationId,
            orgId,
            workspaceId,
            userId,
            metric,
            quantity,
            operationId,
            createdAt: Date.now(),
            expiresAt: Date.now() + ttlMs
        };

        this.reservations.set(reservationId, reservation);

        // Auto-release timeout
        const timer = setTimeout(() => {
            this.releaseReservation(reservationId);
        }, ttlMs);
        if (typeof timer.unref === 'function') {
            timer.unref();
        }
        this.reservationTimeouts.set(reservationId, timer);

        return reservation;
    }

    /**
     * Commits usage and persists authoritative usage event
     */
    async commitUsage({
        reservationId = null,
        orgId,
        workspaceId = null,
        userId = null,
        resourceType = 'general',
        metric,
        quantity = 1,
        unit = 'count',
        operationId = null,
        idempotencyKey = null,
        source = 'Web App',
        metadata = {}
    }) {
        // Clean up reservation if one was held
        if (reservationId) {
            const res = this.reservations.get(reservationId);
            if (res) {
                orgId = orgId || res.orgId;
                workspaceId = workspaceId || res.workspaceId;
                userId = userId || res.userId;
                metric = metric || res.metric;
                quantity = quantity || res.quantity;
                this.releaseReservation(reservationId);
            }
        }

        if (!orgId || !metric) return null;

        const org = await supabaseService.getOrganization(orgId);
        const billingPeriod = org ? this.getCurrentBillingPeriod(org) : { start: null, end: null };

        const event = {
            id: `usevt_${crypto.randomBytes(8).toString('hex')}`,
            orgId: String(orgId),
            workspaceId: workspaceId ? String(workspaceId) : null,
            userId: userId ? String(userId) : null,
            resourceType: String(resourceType),
            metric: String(metric),
            quantity: Math.max(0, Number(quantity) || 1),
            unit: String(unit || METRIC_METADATA[metric]?.unit || 'count'),
            operationId: operationId ? String(operationId) : null,
            idempotencyKey: idempotencyKey ? String(idempotencyKey) : null,
            source: String(source),
            metadata: metadata || {},
            billingPeriodStart: billingPeriod.start,
            billingPeriodEnd: billingPeriod.end,
            status: 'committed',
            timestamp: new Date().toISOString()
        };

        const saved = await supabaseService.saveUsageEvent(event);

        // Check warning notification thresholds after recording usage
        this._checkAndEmitThresholdWarnings(orgId, metric, billingPeriod).catch(() => {});

        return saved;
    }

    /**
     * Releases an active reservation without committing usage (e.g. on operation failure)
     */
    releaseReservation(reservationId) {
        if (!reservationId) return;
        this.reservations.delete(reservationId);
        const timer = this.reservationTimeouts.get(reservationId);
        if (timer) {
            clearTimeout(timer);
            this.reservationTimeouts.delete(reservationId);
        }
    }

    /**
     * Records delta change in artifact storage bytes (increments or decrements)
     */
    async recordStorageDelta(orgId, bytesDelta, operationId = null) {
        if (!orgId || !bytesDelta) return;
        return supabaseService.recordOrgStorageDelta(orgId, bytesDelta, operationId);
    }

    /**
     * Evaluates warning thresholds and logs warning audit event without sending duplicates
     */
    async _checkAndEmitThresholdWarnings(orgId, metric, billingPeriod) {
        try {
            const usage = await this.getOrganizationUsage(orgId);
            const m = usage.metrics[metric];
            if (!m || m.percentage < 50) return;

            const meta = METRIC_METADATA[metric];
            if (!meta) return;

            for (const t of meta.warningThresholds) {
                const thresholdPct = Math.round(t * 100);
                if (m.percentage >= thresholdPct) {
                    const alertKey = `${orgId}:${metric}:${thresholdPct}:${billingPeriod.start}`;
                    if (!this.deduplicatedAlerts.has(alertKey)) {
                        this.deduplicatedAlerts.add(alertKey);

                        await auditService.log({
                            orgId,
                            action: 'quota.warning_threshold_reached',
                            resourceType: 'quota',
                            resourceId: metric,
                            resourceDisplayName: `${meta.name} (${thresholdPct}%)`,
                            outcome: thresholdPct >= 100 ? 'Denied' : 'Success',
                            source: 'Background Worker',
                            metadata: {
                                metric,
                                thresholdPercent: thresholdPct,
                                used: m.used,
                                allowance: m.allowance,
                                remaining: m.remaining
                            }
                        });
                    }
                }
            }
        } catch (err) {
            logger.warn('Failed to check usage warning thresholds:', err.message);
        }
    }

    /**
     * Platform administrator: Updates custom plan quota allowances
     */
    async updatePlanQuotas(planId, updates, adminActor = null) {
        const cleanPlan = (planId || '').toLowerCase();
        if (!this.planAllowances[cleanPlan]) {
            throw new Error(`Invalid plan tier: ${planId}`);
        }

        const before = JSON.parse(JSON.stringify(this.planAllowances[cleanPlan]));
        for (const [metric, allowance] of Object.entries(updates)) {
            if (METRIC_METADATA[metric] && typeof allowance === 'number' && allowance >= 0) {
                this.planAllowances[cleanPlan][metric] = allowance;
            }
        }
        const after = JSON.parse(JSON.stringify(this.planAllowances[cleanPlan]));

        // Persist to store
        await supabaseService.savePlanQuotas(this.planAllowances);

        // Audit log the administrative change
        if (adminActor) {
            await auditService.log({
                orgId: 'system',
                actorId: adminActor.id || adminActor._id || 'admin',
                actorDisplayName: adminActor.name || adminActor.email || 'Platform Admin',
                action: 'admin.plan_quotas_updated',
                resourceType: 'quota',
                resourceId: cleanPlan,
                resourceDisplayName: `${cleanPlan.toUpperCase()} Plan Quotas`,
                outcome: 'Success',
                source: 'API',
                before,
                after
            });
        }

        return this.planAllowances[cleanPlan];
    }

    /**
     * Resolves the target organization for an incoming HTTP request
     */
    async resolveOrgForRequest(req, fallbackUserId = null) {
        const headers = req?.headers || {};
        const query = req?.query || {};
        const body = req?.body || {};
        const params = req?.params || {};

        let orgId = req?.org?.id || params.orgId || body.orgId || query.orgId || headers['x-organization-id'];
        if (orgId) return String(orgId);

        // Check if workspace is present
        const workspaceId = params.workspaceId || body.workspaceId || query.workspaceId || headers['x-workspace-id'];
        if (workspaceId) {
            try {
                const ws = await supabaseService.getWorkspace(workspaceId);
                if (ws?.org_id || ws?.organizationId || ws?.orgId) {
                    return String(ws.org_id || ws.organizationId || ws.orgId);
                }
            } catch (e) {}
        }

        // Check user's organizations
        const userId = fallbackUserId || req?.user?._id || req?.user?.id;
        if (userId) {
            try {
                const orgs = await supabaseService.getUserOrganizations(userId);
                if (orgs && orgs.length > 0) {
                    return String(orgs[0].id);
                }
            } catch (e) {}
        }

        return null;
    }

    /**
     * Returns current plan allowances for all tiers
     */
    getAllPlanQuotas() {
        return JSON.parse(JSON.stringify(this.planAllowances));
    }
}

module.exports = new UsageMeteringService();
