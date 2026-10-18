const supabaseService = require('../services/supabaseData.service');
const logger = require('../utils/logger');
const { parseClientIp } = require('../utils/deviceParser');
const { validateEnvironmentUrl } = require('../utils/ssrfValidator');

/**
 * Controller for Workspace Settings, Tenant Isolation, and Environments
 */

// Helper to sanitize and validate workspace name
const validateWorkspaceName = (name) => {
    if (typeof name !== 'string') {
        return { valid: false, message: 'Workspace name must be a string.' };
    }
    const trimmed = name.trim();
    if (!trimmed || trimmed.length === 0) {
        return { valid: false, message: 'Workspace name cannot be empty or whitespace only.' };
    }
    if (trimmed.length < 2) {
        return { valid: false, message: 'Workspace name must be at least 2 characters long.' };
    }
    if (trimmed.length > 60) {
        return { valid: false, message: 'Workspace name cannot exceed 60 characters.' };
    }
    return { valid: true, value: trimmed };
};

/**
 * GET /api/v1/workspaces/current
 * Retrieve the active workspace for the authenticated user
 */
const getCurrentWorkspaceSettings = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const userName = req.user.name || req.user.displayName || req.user.email?.split('@')[0] || '';

        const workspace = await supabaseService.getUserPrimaryWorkspace(userId, userName);
        if (!workspace) {
            return res.status(404).json({
                success: false,
                code: 'WORKSPACE_NOT_FOUND',
                message: 'No active workspace found for user.'
            });
        }

        // Fetch environments for this workspace
        const environments = await supabaseService.getWorkspaceEnvironments(workspace.id);

        let defaultEnvironment = null;
        if (workspace.defaultEnvironmentId) {
            defaultEnvironment = environments.find(e => e.id === workspace.defaultEnvironmentId) || null;
        }

        return res.json({
            success: true,
            data: {
                id: workspace.id,
                name: workspace.name,
                slug: workspace.slug,
                ownerId: workspace.ownerId,
                defaultEnvironmentId: workspace.defaultEnvironmentId,
                defaultEnvironment,
                role: workspace.role || 'owner',
                version: workspace.version || 1,
                createdAt: workspace.createdAt,
                updatedAt: workspace.updatedAt
            }
        });
    } catch (error) {
        logger.error('Error in getCurrentWorkspaceSettings:', error);
        return res.status(500).json({
            success: false,
            code: 'INTERNAL_ERROR',
            message: 'Failed to retrieve workspace settings.'
        });
    }
};

/**
 * GET /api/v1/workspaces/:workspaceId/settings
 * Retrieve settings for a specific workspace (with tenant isolation check)
 */
const getWorkspaceSettings = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        let effectiveWorkspaceId = req.params.workspaceId;
        if (!effectiveWorkspaceId || effectiveWorkspaceId === 'current') {
            const primary = await supabaseService.getUserPrimaryWorkspace(userId, req.user.name || '');
            if (!primary) {
                return res.status(404).json({
                    success: false,
                    code: 'WORKSPACE_NOT_FOUND',
                    message: 'No active workspace found for user.'
                });
            }
            effectiveWorkspaceId = primary.id;
        }

        // Tenant Isolation: Verify membership
        const membership = await supabaseService.getWorkspaceMembership(effectiveWorkspaceId, userId);
        if (!membership || membership.status !== 'active') {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to access this workspace.'
            });
        }

        const workspace = await supabaseService.getWorkspace(effectiveWorkspaceId);
        if (!workspace) {
            return res.status(404).json({
                success: false,
                code: 'WORKSPACE_NOT_FOUND',
                message: 'Workspace not found.'
            });
        }

        // Fetch environments
        const environments = await supabaseService.getWorkspaceEnvironments(effectiveWorkspaceId);
        let defaultEnvironment = null;
        if (workspace.defaultEnvironmentId) {
            defaultEnvironment = environments.find(e => e.id === workspace.defaultEnvironmentId) || null;
        }

        return res.json({
            success: true,
            data: {
                id: workspace.id,
                name: workspace.name,
                slug: workspace.slug,
                ownerId: workspace.ownerId,
                defaultEnvironmentId: workspace.defaultEnvironmentId,
                defaultEnvironment,
                role: membership.role,
                version: workspace.version || 1,
                createdAt: workspace.createdAt,
                updatedAt: workspace.updatedAt
            }
        });
    } catch (error) {
        logger.error('Error in getWorkspaceSettings:', error);
        return res.status(500).json({
            success: false,
            code: 'INTERNAL_ERROR',
            message: 'Failed to retrieve workspace settings.'
        });
    }
};

/**
 * PATCH /api/v1/workspaces/:workspaceId/settings
 * Update workspace name and/or default environment with authorization & concurrency
 */
const updateWorkspaceSettings = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        let effectiveWorkspaceId = req.params.workspaceId;
        if (!effectiveWorkspaceId || effectiveWorkspaceId === 'current') {
            const primary = await supabaseService.getUserPrimaryWorkspace(userId, req.user.name || '');
            if (!primary) {
                return res.status(404).json({
                    success: false,
                    code: 'WORKSPACE_NOT_FOUND',
                    message: 'No active workspace found for user.'
                });
            }
            effectiveWorkspaceId = primary.id;
        }

        // 1. Tenant Isolation: Verify active membership
        const membership = await supabaseService.getWorkspaceMembership(effectiveWorkspaceId, userId);
        if (!membership || membership.status !== 'active') {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to access this workspace.'
            });
        }

        // 2. Authorization: Only 'owner' or 'admin' can modify workspace settings
        const allowedRoles = ['owner', 'admin'];
        if (!allowedRoles.includes(membership.role)) {
            return res.status(403).json({
                success: false,
                code: 'PERMISSION_DENIED',
                message: 'Only workspace owners and administrators can modify workspace settings.'
            });
        }

        // 3. Reject unknown / unauthorized fields
        const allowedFields = ['name', 'defaultEnvironmentId', 'version'];
        const receivedFields = Object.keys(req.body);
        const unknownFields = receivedFields.filter(f => !allowedFields.includes(f));
        if (unknownFields.length > 0) {
            return res.status(400).json({
                success: false,
                code: 'DISALLOWED_FIELDS',
                message: `Request contains unauthorized or unknown fields: ${unknownFields.join(', ')}.`
            });
        }

        const updates = {};

        // 4. Validate name if provided
        if (req.body.name !== undefined) {
            const nameCheck = validateWorkspaceName(req.body.name);
            if (!nameCheck.valid) {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_WORKSPACE_NAME',
                    message: nameCheck.message
                });
            }
            updates.name = nameCheck.value;
        }

        // 5. Validate defaultEnvironmentId if provided
        if (req.body.defaultEnvironmentId !== undefined) {
            if (req.body.defaultEnvironmentId !== null && typeof req.body.defaultEnvironmentId !== 'string') {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_ENVIRONMENT_ID',
                    message: 'Default environment ID must be a valid string or null.'
                });
            }
            updates.defaultEnvironmentId = req.body.defaultEnvironmentId;
        }

        // 6. Concurrency expected version
        if (req.body.version !== undefined) {
            const verNum = Number(req.body.version);
            if (isNaN(verNum)) {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_VERSION',
                    message: 'Version must be an integer.'
                });
            }
            updates.expectedVersion = verNum;
        }

        // Nothing to update
        if (Object.keys(updates).length === 0 || (updates.name === undefined && updates.defaultEnvironmentId === undefined)) {
            const current = await supabaseService.getWorkspace(workspaceId);
            return res.json({
                success: true,
                message: 'No changes submitted.',
                data: {
                    ...current,
                    role: membership.role
                }
            });
        }

        // 7. Perform atomic update with audit logging
        const auditMeta = {
            ipAddress: parseClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        };

        const updated = await supabaseService.updateWorkspaceSettings(
            effectiveWorkspaceId,
            updates,
            userId,
            auditMeta
        );

        // Fetch environments to attach defaultEnvironment detail
        const environments = await supabaseService.getWorkspaceEnvironments(effectiveWorkspaceId);
        let defaultEnvironment = null;
        if (updated.defaultEnvironmentId) {
            defaultEnvironment = environments.find(e => e.id === updated.defaultEnvironmentId) || null;
        }

        return res.json({
            success: true,
            message: 'Workspace settings updated successfully.',
            data: {
                id: updated.id,
                name: updated.name,
                slug: updated.slug,
                ownerId: updated.ownerId,
                defaultEnvironmentId: updated.defaultEnvironmentId,
                defaultEnvironment,
                role: membership.role,
                version: updated.version,
                createdAt: updated.createdAt,
                updatedAt: updated.updatedAt
            }
        });
    } catch (error) {
        if (error.code === 'CONCURRENCY_CONFLICT') {
            return res.status(409).json({
                success: false,
                code: 'CONCURRENCY_CONFLICT',
                message: error.message,
                data: {
                    currentSettings: error.currentSettings
                }
            });
        }
        if (error.code === 'INVALID_ENVIRONMENT') {
            return res.status(400).json({
                success: false,
                code: 'INVALID_ENVIRONMENT',
                message: error.message
            });
        }
        if (error.code === 'WORKSPACE_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                code: 'NOT_FOUND',
                message: error.message
            });
        }

        logger.error('Error updating workspace settings:', error);
        return res.status(500).json({
            success: false,
            code: 'INTERNAL_ERROR',
            message: 'Failed to update workspace settings.'
        });
    }
};

/**
 * GET /api/v1/workspaces/:workspaceId/environments
 * List active configured environments for a workspace
 */
const getWorkspaceEnvironments = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        let effectiveWorkspaceId = req.params.workspaceId;
        if (!effectiveWorkspaceId || effectiveWorkspaceId === 'current') {
            const primary = await supabaseService.getUserPrimaryWorkspace(userId, req.user.name || '');
            if (!primary) {
                return res.status(404).json({
                    success: false,
                    code: 'WORKSPACE_NOT_FOUND',
                    message: 'No active workspace found for user.'
                });
            }
            effectiveWorkspaceId = primary.id;
        }

        // Tenant Isolation: Verify membership
        const membership = await supabaseService.getWorkspaceMembership(effectiveWorkspaceId, userId);
        if (!membership || membership.status !== 'active') {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to access this workspace.'
            });
        }

        const environments = await supabaseService.getWorkspaceEnvironments(effectiveWorkspaceId);

        // Security: In production, filter out localhost/loopback environments
        const isProduction = process.env.NODE_ENV === 'production';
        const filtered = environments.filter(env => {
            if (!isProduction) return true;
            if (!env.baseUrl) return true;
            try {
                const u = new URL(env.baseUrl);
                const host = u.hostname.toLowerCase();
                return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1' && host !== '0.0.0.0';
            } catch {
                return false;
            }
        });

        // Security: Ensure no credentials, API keys, or secrets are returned
        const sanitized = filtered.map(env => ({
            id: env.id,
            workspaceId: env.workspaceId,
            name: env.name,
            slug: env.slug,
            baseUrl: env.baseUrl,
            isActive: env.isActive,
            createdAt: env.createdAt,
            updatedAt: env.updatedAt
        }));

        return res.json({
            success: true,
            data: sanitized
        });
    } catch (error) {
        logger.error('Error listing workspace environments:', error);
        return res.status(500).json({
            success: false,
            code: 'INTERNAL_ERROR',
            message: 'Failed to list workspace environments.'
        });
    }
};

/**
 * POST /api/v1/workspaces/:workspaceId/environments
 * Create a new environment for the workspace with SSRF validation
 */
const createWorkspaceEnvironment = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        let effectiveWorkspaceId = req.params.workspaceId;
        if (!effectiveWorkspaceId || effectiveWorkspaceId === 'current') {
            const primary = await supabaseService.getUserPrimaryWorkspace(userId, req.user.name || '');
            if (!primary) {
                return res.status(404).json({
                    success: false,
                    code: 'WORKSPACE_NOT_FOUND',
                    message: 'No active workspace found for user.'
                });
            }
            effectiveWorkspaceId = primary.id;
        }

        // 1. Tenant Isolation: Verify membership
        const membership = await supabaseService.getWorkspaceMembership(effectiveWorkspaceId, userId);
        if (!membership || membership.status !== 'active') {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to access this workspace.'
            });
        }

        // 2. Authorization: Only owner and admin can configure environments
        if (membership.role !== 'owner' && membership.role !== 'admin') {
            return res.status(403).json({
                success: false,
                code: 'PERMISSION_DENIED',
                message: 'Only workspace owners and administrators can add environments.'
            });
        }

        // 3. Validate name
        const name = (req.body.name || '').trim();
        if (!name || name.length < 2 || name.length > 60) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_NAME',
                message: 'Environment name must be between 2 and 60 characters.'
            });
        }

        // 4. Validate baseUrl with SSRF protection
        const baseUrl = (req.body.baseUrl || '').trim();
        if (baseUrl) {
            const isDev = process.env.NODE_ENV !== 'production';
            const check = validateEnvironmentUrl(baseUrl, isDev);
            if (!check.valid) {
                return res.status(400).json({
                    success: false,
                    code: 'SSRF_BLOCKED',
                    message: check.message
                });
            }
        }

        const env = await supabaseService.createWorkspaceEnvironment(effectiveWorkspaceId, {
            name,
            slug: req.body.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            baseUrl
        });

        return res.status(201).json({
            success: true,
            message: 'Environment created successfully.',
            data: {
                id: env.id,
                workspaceId: env.workspaceId,
                name: env.name,
                slug: env.slug,
                baseUrl: env.baseUrl,
                isActive: env.isActive,
                createdAt: env.createdAt,
                updatedAt: env.updatedAt
            }
        });
    } catch (error) {
        logger.error('Error creating workspace environment:', error);
        return res.status(500).json({
            success: false,
            code: 'INTERNAL_ERROR',
            message: 'Failed to create workspace environment.'
        });
    }
};

/**
 * DELETE /api/v1/workspaces/:workspaceId/environments/:environmentId
 * Delete an environment from a workspace
 */
const deleteWorkspaceEnvironment = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        let effectiveWorkspaceId = req.params.workspaceId;
        const environmentId = req.params.environmentId;

        if (!effectiveWorkspaceId || effectiveWorkspaceId === 'current') {
            const primary = await supabaseService.getUserPrimaryWorkspace(userId, req.user.name || '');
            if (!primary) {
                return res.status(404).json({
                    success: false,
                    code: 'WORKSPACE_NOT_FOUND',
                    message: 'No active workspace found for user.'
                });
            }
            effectiveWorkspaceId = primary.id;
        }

        const membership = await supabaseService.getWorkspaceMembership(effectiveWorkspaceId, userId);
        if (!membership || membership.status !== 'active') {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to access this workspace.'
            });
        }

        if (membership.role !== 'owner' && membership.role !== 'admin') {
            return res.status(403).json({
                success: false,
                code: 'PERMISSION_DENIED',
                message: 'Only workspace owners and administrators can delete environments.'
            });
        }

        await supabaseService.deleteWorkspaceEnvironment(effectiveWorkspaceId, environmentId);

        return res.json({
            success: true,
            message: 'Environment deleted successfully.'
        });
    } catch (error) {
        logger.error('Error deleting workspace environment:', error);
        return res.status(500).json({
            success: false,
            code: 'INTERNAL_ERROR',
            message: 'Failed to delete workspace environment.'
        });
    }
};

module.exports = {
    getCurrentWorkspaceSettings,
    getWorkspaceSettings,
    updateWorkspaceSettings,
    getWorkspaceEnvironments,
    createWorkspaceEnvironment,
    deleteWorkspaceEnvironment
};

