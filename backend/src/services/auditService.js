/**
 * TestNexa AI — Centralized Audit Logging Service
 * Provides durable, structured, sanitized audit logging across the entire TestNexa platform.
 * 
 * Enforces:
 * - Server-derived actor identity
 * - Deep credential & secret redaction
 * - Idempotent event creation
 * - Structured metadata and before/after diff tracking
 * - Safe CSV serialization with formula injection defense
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const supabaseService = require('./supabaseData.service');

// Sensitive keys that must NEVER be persisted in audit metadata or diffs
const SENSITIVE_KEY_PATTERNS = [
    /pass(word)?/i,
    /secret/i,
    /token/i,
    /bearer/i,
    /api[_-]?key/i,
    /auth(orization)?/i,
    /cookie/i,
    /private[_-]?key/i,
    /credential/i,
    /session[_-]?id/i
];

/**
 * Recursively redacts sensitive keys from metadata or change objects
 */
function redactSensitiveData(data, depth = 0) {
    if (depth > 6) return '[DepthLimitExceeded]';
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') return data;

    if (Array.isArray(data)) {
        return data.map(item => redactSensitiveData(item, depth + 1));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        const isSensitive = SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
        if (isSensitive) {
            if (value && typeof value === 'object' && ('before' in value || 'after' in value)) {
                sanitized[key] = {
                    before: value.before !== undefined && value.before !== null ? '[REDACTED]' : value.before,
                    after: value.after !== undefined && value.after !== null ? '[REDACTED]' : value.after
                };
            } else {
                sanitized[key] = '[REDACTED]';
            }
        } else if (value && typeof value === 'object') {
            sanitized[key] = redactSensitiveData(value, depth + 1);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

/**
 * Computes meaningful field-level before and after changes between two objects
 * Determines changes using raw keys, then deep-redacts all sensitive contents.
 */
function computeFieldDiff(before, after) {
    if (!before && !after) return null;
    const rawBefore = before || {};
    const rawAfter = after || {};

    const diff = {};
    const allKeys = new Set([...Object.keys(rawBefore), ...Object.keys(rawAfter)]);

    for (const key of allKeys) {
        const valB = rawBefore[key];
        const valA = rawAfter[key];

        const strB = typeof valB === 'object' ? JSON.stringify(valB) : String(valB);
        const strA = typeof valA === 'object' ? JSON.stringify(valA) : String(valA);

        if (strB !== strA) {
            diff[key] = {
                before: valB !== undefined ? valB : null,
                after: valA !== undefined ? valA : null
            };
        }
    }

    if (Object.keys(diff).length === 0) return null;
    return redactSensitiveData(diff);
}

/**
 * Escapes CSV values and prevents Formula Injection (=, +, -, @, \t, \r)
 */
function escapeCsvCell(value) {
    if (value === null || value === undefined) return '""';
    let str = typeof value === 'object' ? JSON.stringify(value) : String(value);

    // Prevent CSV formula injection in spreadsheet viewers
    if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
    }

    // Escape quotes
    return `"${str.replace(/"/g, '""')}"`;
}

class AuditService {
    constructor() {
        this.recentIdempotencyKeys = new Map(); // key -> eventId (TTL 10 min)
    }

    /**
     * Records a structured audit event
     */
    async log({
        orgId,
        workspaceId = null,
        projectId = null,
        actorId = 'system',
        actorDisplayName = 'System',
        actorEmail = null,
        actorType = 'User', // 'User' | 'System' | 'Integration'
        action,
        resourceType,
        resourceId = null,
        resourceDisplayName = null,
        outcome = 'Success', // 'Success' | 'Failure' | 'Denied'
        source = 'Web App',  // 'Web App' | 'API' | 'CI/CD' | 'Background Worker'
        correlationId = null,
        idempotencyKey = null,
        metadata = {},
        before = null,
        after = null,
        changes = null,
        timestamp = null
    }) {
        try {
            if (!orgId || !action) {
                logger.warn('[AuditService] Skipping audit event: orgId and action are required');
                return null;
            }

            // Check idempotency to prevent duplicate logs on rapid retries
            if (idempotencyKey) {
                const existingEventId = this.recentIdempotencyKeys.get(idempotencyKey);
                if (existingEventId) {
                    return supabaseService.getAuditEventById(orgId, existingEventId);
                }
            }

            // Compute changes if before/after provided
            const resolvedChanges = changes 
                ? redactSensitiveData(changes) 
                : (before || after ? computeFieldDiff(before, after) : null);

            const sanitizedMetadata = redactSensitiveData(metadata || {});

            const event = {
                id: `aevt_${crypto.randomBytes(8).toString('hex')}`,
                orgId: String(orgId),
                workspaceId: workspaceId ? String(workspaceId) : null,
                projectId: projectId ? String(projectId) : null,
                actorId: String(actorId),
                actorDisplayName: actorDisplayName || 'Unknown User',
                actorEmail: actorEmail || null,
                actorType: ['User', 'System', 'Integration'].includes(actorType) ? actorType : 'User',
                action: String(action),
                resourceType: String(resourceType || 'general'),
                resourceId: resourceId ? String(resourceId) : null,
                resourceDisplayName: resourceDisplayName ? String(resourceDisplayName) : null,
                outcome: ['Success', 'Failure', 'Denied'].includes(outcome) ? outcome : 'Success',
                source: ['Web App', 'API', 'CI/CD', 'Background Worker'].includes(source) ? source : 'Web App',
                correlationId: correlationId || `corr_${crypto.randomBytes(6).toString('hex')}`,
                metadata: sanitizedMetadata,
                changes: resolvedChanges,
                timestamp: timestamp || new Date().toISOString()
            };

            // Save via persistence layer
            const saved = await supabaseService.saveAuditEvent(event);

            if (idempotencyKey) {
                this.recentIdempotencyKeys.set(idempotencyKey, event.id);
                // Purge key after 10 minutes
                const timer = setTimeout(() => {
                    this.recentIdempotencyKeys.delete(idempotencyKey);
                }, 10 * 60 * 1000);
                if (typeof timer.unref === 'function') {
                    timer.unref();
                }
            }

            return saved;
        } catch (err) {
            logger.error('[AuditService] Failed to record audit log:', err);
            // Non-blocking: audit logging failures should not crash application request
            return null;
        }
    }

    /**
     * Convenience helper to log from Express request context
     */
    async logFromRequest(req, {
        orgId = null,
        workspaceId = null,
        projectId = null,
        action,
        resourceType,
        resourceId = null,
        resourceDisplayName = null,
        outcome = 'Success',
        metadata = {},
        before = null,
        after = null,
        changes = null
    }) {
        const headers = req.headers || {};
        const resolvedOrgId = orgId || req.org?.id || req.params?.orgId || req.body?.orgId || headers['x-organization-id'];
        const resolvedWorkspaceId = workspaceId || req.params?.workspaceId || req.body?.workspaceId || headers['x-workspace-id'];
        const resolvedProjectId = projectId || req.params?.projectId || req.body?.projectId;

        // Derive actor safely from server auth context only
        const user = req.user;
        const actorId = user ? (user._id || user.id || 'anonymous') : 'system';
        const actorDisplayName = user ? (user.displayName || user.name || user.email || 'User') : 'System';
        const actorEmail = user?.email || null;
        const actorType = req.isCiCd ? 'Integration' : (user ? 'User' : 'System');

        // Detect source
        let source = 'Web App';
        if (headers['x-cicd-delivery'] || req.baseUrl?.includes('cicd')) {
            source = 'CI/CD';
        } else if (headers['x-api-key'] || headers['accept']?.includes('application/json')) {
            source = 'API';
        }

        const correlationId = headers['x-correlation-id'] || req.id;
        const idempotencyKey = headers['idempotency-key'] || null;

        return this.log({
            orgId: resolvedOrgId,
            workspaceId: resolvedWorkspaceId,
            projectId: resolvedProjectId,
            actorId,
            actorDisplayName,
            actorEmail,
            actorType,
            action,
            resourceType,
            resourceId,
            resourceDisplayName,
            outcome,
            source,
            correlationId,
            idempotencyKey,
            metadata,
            before,
            after,
            changes
        });
    }

    /**
     * Query audit events with pagination and filters
     */
    async getEvents(orgId, filters = {}) {
        return supabaseService.getAuditEvents({ orgId, ...filters });
    }

    /**
     * Get a single event by ID
     */
    async getEventById(orgId, eventId) {
        return supabaseService.getAuditEventById(orgId, eventId);
    }

    /**
     * Get resource-specific activity history
     */
    async getResourceActivity(resourceType, resourceId, options = {}) {
        return supabaseService.getResourceActivityHistory(resourceType, resourceId, options);
    }

    /**
     * Exports audit events to safe CSV string
     */
    async exportToCsv(orgId, filters = {}) {
        // Fetch up to 5000 records for export
        const result = await supabaseService.getAuditEvents({
            orgId,
            ...filters,
            page: 1,
            limit: 5000
        });

        const events = result.events || [];
        const headers = [
            'Event ID',
            'Timestamp (UTC)',
            'Actor Name',
            'Actor Email',
            'Actor Type',
            'Action',
            'Resource Type',
            'Resource Name',
            'Resource ID',
            'Workspace ID',
            'Project ID',
            'Outcome',
            'Source',
            'Correlation ID',
            'Metadata Summary'
        ];

        const rows = [headers.join(',')];

        for (const evt of events) {
            const metaSummary = evt.metadata ? JSON.stringify(evt.metadata) : '';
            const row = [
                escapeCsvCell(evt.id),
                escapeCsvCell(evt.timestamp),
                escapeCsvCell(evt.actorDisplayName),
                escapeCsvCell(evt.actorEmail || ''),
                escapeCsvCell(evt.actorType),
                escapeCsvCell(evt.action),
                escapeCsvCell(evt.resourceType),
                escapeCsvCell(evt.resourceDisplayName || ''),
                escapeCsvCell(evt.resourceId || ''),
                escapeCsvCell(evt.workspaceId || ''),
                escapeCsvCell(evt.projectId || ''),
                escapeCsvCell(evt.outcome),
                escapeCsvCell(evt.source),
                escapeCsvCell(evt.correlationId || ''),
                escapeCsvCell(metaSummary)
            ];
            rows.push(row.join(','));
        }

        return rows.join('\r\n');
    }
}

module.exports = new AuditService();
