const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { validateEnvironmentUrl } = require('../utils/ssrfValidator');

/**
 * Supabase Data Service
 * Provides full database operations for Testnexa AI on Supabase PostgreSQL.
 * Serves as the authoritative and permanent persistence layer.
 */
class SupabaseDataService {
    constructor() {
        this.inMemoryAuthSessions = new Map();
        this.authSessionsTableAvailable = null; // null = untested, true/false
        this.inMemoryWorkspaces = new Map();
        this.inMemoryWorkspaceMembers = new Map();
        this.inMemoryEnvironments = new Map();
        this.inMemorySuiteShares = new Map();
        this.inMemorySuiteSharesByToken = new Map();
        this.inMemoryAuditLogs = [];
        this.workspacesTableAvailable = null;
        this.storeFilePath = path.resolve(__dirname, '../../data/workspaces_store.json');
        this._loadDiskWorkspacesStore();
    }

    _loadDiskWorkspacesStore() {
        try {
            if (fs.existsSync(this.storeFilePath)) {
                const raw = fs.readFileSync(this.storeFilePath, 'utf8');
                const data = JSON.parse(raw);
                if (data.workspaces && typeof data.workspaces === 'object') {
                    for (const [k, v] of Object.entries(data.workspaces)) {
                        this.inMemoryWorkspaces.set(k, v);
                    }
                }
                if (data.members && typeof data.members === 'object') {
                    for (const [k, v] of Object.entries(data.members)) {
                        this.inMemoryWorkspaceMembers.set(k, v);
                    }
                }
                if (data.environments && typeof data.environments === 'object') {
                    for (const [k, v] of Object.entries(data.environments)) {
                        this.inMemoryEnvironments.set(k, v);
                    }
                }
                if (data.shares && typeof data.shares === 'object') {
                    for (const [k, v] of Object.entries(data.shares)) {
                        this.inMemorySuiteShares.set(k, v);
                        if (v.shareToken) {
                            this.inMemorySuiteSharesByToken.set(v.shareToken, v);
                        }
                    }
                }
                if (Array.isArray(data.auditLogs)) {
                    this.inMemoryAuditLogs = data.auditLogs;
                }
            }
        } catch (err) {
            logger.warn('Failed to load disk workspace store:', err.message);
        }
    }

    _saveDiskWorkspacesStore() {
        try {
            const dir = path.dirname(this.storeFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const data = {
                workspaces: Object.fromEntries(this.inMemoryWorkspaces),
                members: Object.fromEntries(this.inMemoryWorkspaceMembers),
                environments: Object.fromEntries(this.inMemoryEnvironments),
                shares: Object.fromEntries(this.inMemorySuiteShares),
                auditLogs: this.inMemoryAuditLogs.slice(-200)
            };
            fs.writeFileSync(this.storeFilePath, JSON.stringify(data, null, 2), 'utf8');
        } catch (err) {
            logger.warn('Failed to save disk workspace store:', err.message);
        }
    }

    get isAvailable() {
        return Boolean(supabase);
    }

    // ==========================================
    // SESSIONS (workspace_sessions)
    // ==========================================

    async createSession({
        userId,
        title,
        requirement,
        context = 'web',
        depth = 'Standard',
        status = 'Draft',
        messages = [],
        suiteData = null,
        summary = {},
        quality = {},
        currentVersion = 1,
        versions = [],
        generationId = ''
    }) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');

        const sessionPayload = {
            user_id: userId || null,
            title: title || 'Untitled Session',
            raw_requirement: requirement || '',
            requirement: requirement || '',
            app_type: context,
            context: context,
            detail_level: depth,
            depth: depth,
            status: status,
            messages: messages,
            suite_data: suiteData || {},
            summary: summary,
            quality: quality,
            current_version: currentVersion,
            versions: versions,
            generation_id: generationId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('workspace_sessions')
            .insert(sessionPayload)
            .select()
            .single();

        if (error) {
            logger.error('Supabase createSession error:', error);
            throw error;
        }

        return this._formatSession(data);
    }

    async getSession(sessionId, userId) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');

        let query = supabase
            .from('workspace_sessions')
            .select('*')
            .eq('id', sessionId);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query.single();

        if (error) {
            if (error.code === 'PGRST116') return null; // not found
            logger.error('Supabase getSession error:', error);
            throw error;
        }

        return this._formatSession(data);
    }

    async getSuiteShare(suiteId) {
        if (!suiteId) return null;
        let share = this.inMemorySuiteShares.get(suiteId);
        if (!share && this.isAvailable) {
            try {
                const { data } = await supabase
                    .from('workspace_sessions')
                    .select('suite_data')
                    .eq('id', suiteId)
                    .maybeSingle();
                if (data?.suite_data?.shareSettings) {
                    share = data.suite_data.shareSettings;
                    this.inMemorySuiteShares.set(suiteId, share);
                    if (share.shareToken) {
                        this.inMemorySuiteSharesByToken.set(share.shareToken, share);
                    }
                }
            } catch (err) {
                logger.warn('Error reading share settings from session:', err.message);
            }
        }
        return share || null;
    }

    async getSuiteShareByToken(shareToken) {
        if (!shareToken) return null;
        let share = this.inMemorySuiteSharesByToken.get(shareToken);
        if (!share && this.isAvailable) {
            for (const s of this.inMemorySuiteShares.values()) {
                if (s.shareToken === shareToken) {
                    this.inMemorySuiteSharesByToken.set(shareToken, s);
                    return s;
                }
            }
        }
        return share || null;
    }

    async createOrUpdateSuiteShare({ suiteId, ownerId, role = 'reviewer', isPublic = true, status = 'active' }) {
        if (!suiteId) throw new Error('suiteId is required');
        const allowedRoles = ['viewer', 'reviewer', 'editor'];
        const cleanRole = (role || 'reviewer').toLowerCase().trim();
        if (!allowedRoles.includes(cleanRole)) {
            throw new Error(`Invalid share role "${role}". Allowed roles: ${allowedRoles.join(', ')}`);
        }

        const existing = await this.getSuiteShare(suiteId);
        const shareToken = existing?.shareToken || ('sh_' + crypto.randomBytes(16).toString('hex'));
        const now = new Date().toISOString();

        const shareRecord = {
            id: existing?.id || ('shr_' + crypto.randomBytes(8).toString('hex')),
            suiteId,
            ownerId: ownerId || existing?.ownerId,
            shareToken,
            role: cleanRole,
            status: status || 'active',
            isPublic: isPublic !== false,
            createdAt: existing?.createdAt || now,
            updatedAt: now
        };

        this.inMemorySuiteShares.set(suiteId, shareRecord);
        this.inMemorySuiteSharesByToken.set(shareToken, shareRecord);
        this._saveDiskWorkspacesStore();

        if (this.isAvailable) {
            try {
                const { data: currentSession } = await supabase
                    .from('workspace_sessions')
                    .select('suite_data')
                    .eq('id', suiteId)
                    .maybeSingle();

                if (currentSession) {
                    const updatedSuiteData = {
                        ...(currentSession.suite_data || {}),
                        shareSettings: shareRecord
                    };
                    await supabase
                        .from('workspace_sessions')
                        .update({ suite_data: updatedSuiteData })
                        .eq('id', suiteId);
                }
            } catch (err) {
                logger.warn('Failed to persist shareSettings into Supabase session:', err.message);
            }
        }

        return shareRecord;
    }

    async revokeSuiteShare(suiteId, ownerId) {
        if (!suiteId) throw new Error('suiteId is required');
        const existing = await this.getSuiteShare(suiteId);
        if (!existing) {
            const err = new Error('No share configuration found for this test suite');
            err.statusCode = 404;
            err.code = 'SHARE_NOT_FOUND';
            throw err;
        }

        if (ownerId && existing.ownerId && existing.ownerId !== ownerId) {
            const err = new Error('You do not have permission to revoke this share link');
            err.statusCode = 403;
            err.code = 'PERMISSION_DENIED';
            throw err;
        }

        const now = new Date().toISOString();
        existing.status = 'revoked';
        existing.updatedAt = now;

        this.inMemorySuiteShares.set(suiteId, existing);
        if (existing.shareToken) {
            this.inMemorySuiteSharesByToken.set(existing.shareToken, existing);
        }
        this._saveDiskWorkspacesStore();

        if (this.isAvailable) {
            try {
                const { data: currentSession } = await supabase
                    .from('workspace_sessions')
                    .select('suite_data')
                    .eq('id', suiteId)
                    .maybeSingle();

                if (currentSession) {
                    const updatedSuiteData = {
                        ...(currentSession.suite_data || {}),
                        shareSettings: existing
                    };
                    await supabase
                        .from('workspace_sessions')
                        .update({ suite_data: updatedSuiteData })
                        .eq('id', suiteId);
                }
            } catch (err) {
                logger.warn('Failed to update revoked shareSettings in Supabase:', err.message);
            }
        }

        return existing;
    }

    async getSharedSession(sessionId, shareToken, userId) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');
        if (!sessionId) {
            return { error: 'INVALID_ID', status: 400, message: 'Invalid session ID' };
        }

        const { data: rawSession, error } = await supabase
            .from('workspace_sessions')
            .select('*')
            .eq('id', sessionId)
            .maybeSingle();

        if (error) {
            logger.error('Supabase getSharedSession error:', error);
            return { error: 'SERVER_ERROR', status: 500, message: 'Database error retrieving session' };
        }

        if (!rawSession) {
            return { error: 'SUITE_NOT_FOUND', status: 404, message: 'Test suite not found or has been deleted' };
        }

        const session = this._formatSession(rawSession);

        const sessionOwnerId = rawSession.user_id || session.userId;
        if (userId && sessionOwnerId && String(userId) === String(sessionOwnerId)) {
            return {
                session: {
                    ...session,
                    accessRole: 'owner',
                    isOwner: true,
                    isShared: false
                }
            };
        }

        let share = await this.getSuiteShare(sessionId);
        if (!share && shareToken) {
            share = await this.getSuiteShareByToken(shareToken);
        }

        if (!share) {
            return {
                error: 'SUITE_NOT_FOUND',
                status: 404,
                message: 'Session not found'
            };
        }

        // For non-owners, an active share link and matching shareToken are strictly required
        if (share.status === 'revoked') {
            return {
                error: 'SHARE_REVOKED',
                status: 403,
                message: 'This share link has been revoked by the owner'
            };
        }

        if (!shareToken || (share.shareToken && shareToken !== share.shareToken)) {
            if (!shareToken) {
                return {
                    error: 'SUITE_NOT_FOUND',
                    status: 404,
                    message: 'Session not found'
                };
            }
            return {
                error: 'ACCESS_DENIED',
                status: 403,
                message: 'Invalid or expired share token'
            };
        }

        if (!share.isPublic && !userId) {
            return {
                error: 'AUTHENTICATION_REQUIRED',
                status: 401,
                message: 'Authentication required to view this private test suite'
            };
        }

        return {
            session: {
                ...session,
                accessRole: share.role || 'viewer',
                isOwner: false,
                isShared: true,
                shareToken: share.shareToken
            }
        };
    }

    async findSessionByGenerationId(generationId, userId) {
        if (!this.isAvailable || !generationId) return null;

        let query = supabase
            .from('workspace_sessions')
            .select('*')
            .eq('generation_id', generationId);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query.maybeSingle();
        if (error) {
            logger.warn('Supabase findSessionByGenerationId warning:', error.message);
            return null;
        }

        return this._formatSession(data);
    }

    async listSessions({ userId, page = 1, limit = 20, status, search, sort = 'updatedAt' }) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('workspace_sessions')
            .select('id, user_id, title, status, raw_requirement, requirement, context, depth, app_type, detail_level, summary, quality, current_version, created_at, updated_at, suite_data', { count: 'exact' });

        if (userId) {
            query = query.eq('user_id', userId);
        }

        if (status) {
            if (status === 'all') {
                // Return all statuses including Archived
            } else if (status === 'Generated') {
                query = query.in('status', ['Generated', 'NeedsReview', 'Approved']);
            } else {
                query = query.eq('status', status);
            }
        } else {
            query = query.neq('status', 'Archived');
        }

        if (search && search.trim()) {
            query = query.or(`title.ilike.%${search}%,raw_requirement.ilike.%${search}%`);
        }

        if (sort === 'createdAt') {
            query = query.order('created_at', { ascending: false });
        } else if (sort === 'title') {
            query = query.order('title', { ascending: true });
        } else {
            query = query.order('updated_at', { ascending: false });
        }

        const { data, count, error } = await query.range(from, to);

        if (error) {
            logger.error('Supabase listSessions error:', error);
            throw error;
        }

        return {
            sessions: (data || []).map(row => this._formatSession(row)),
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit)
        };
    }

    async updateSession(sessionId, userId, updates) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');

        const updatePayload = {
            updated_at: new Date().toISOString()
        };

        if (updates.title !== undefined) updatePayload.title = updates.title;
        if (updates.status !== undefined) updatePayload.status = updates.status;
        if (updates.requirement !== undefined) {
            updatePayload.requirement = updates.requirement;
            updatePayload.raw_requirement = updates.requirement;
        }
        if (updates.context !== undefined) {
            updatePayload.context = updates.context;
            updatePayload.app_type = updates.context;
        }
        if (updates.depth !== undefined) {
            updatePayload.depth = updates.depth;
            updatePayload.detail_level = updates.depth;
        }
        if (updates.messages !== undefined) updatePayload.messages = updates.messages;
        if (updates.suiteData !== undefined) updatePayload.suite_data = updates.suiteData;
        if (updates.summary !== undefined) updatePayload.summary = updates.summary;
        if (updates.quality !== undefined) updatePayload.quality = updates.quality;
        if (updates.currentVersion !== undefined) updatePayload.current_version = updates.currentVersion;
        if (updates.versions !== undefined) updatePayload.versions = updates.versions;

        let query = supabase
            .from('workspace_sessions')
            .update(updatePayload)
            .eq('id', sessionId);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query.select().single();

        if (error) {
            logger.error('Supabase updateSession error:', error);
            throw error;
        }

        return this._formatSession(data);
    }

    async deleteSession(sessionId, userId) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');

        let query = supabase
            .from('workspace_sessions')
            .delete()
            .eq('id', sessionId);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { error } = await query;
        if (error) {
            logger.error('Supabase deleteSession error:', error);
            throw error;
        }
        return true;
    }

    // ==========================================
    // TEST HISTORY (test_history)
    // ==========================================

    async saveTestHistory({
        userId,
        generationId,
        sessionId,
        requirement,
        appType = 'web',
        detailLevel = 'standard',
        testFocus = 'mixed',
        feature = '',
        summary = {},
        quality = {},
        data = {},
        processingTime = '',
        model = ''
    }) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');

        const { data: record, error } = await supabase
            .from('test_history')
            .insert({
                user_id: userId || null,
                generation_id: generationId || '',
                session_id: sessionId || null,
                requirement: requirement || '',
                app_type: appType,
                detail_level: detailLevel,
                test_focus: testFocus,
                feature: feature,
                summary: summary,
                quality: quality,
                data: data,
                processing_time: processingTime,
                model: model,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            logger.error('Supabase saveTestHistory error:', error);
            throw error;
        }

        return record;
    }

    async getTestHistory(userId, { page = 1, limit = 20 } = {}) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, count, error } = await supabase
            .from('test_history')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            logger.error('Supabase getTestHistory error:', error);
            throw error;
        }

        return {
            history: (data || []).map(r => ({
                _id: r.id,
                id: r.id,
                userId: r.user_id,
                generationId: r.generation_id,
                sessionId: r.session_id,
                requirement: r.requirement,
                appType: r.app_type,
                detailLevel: r.detail_level,
                testFocus: r.test_focus,
                feature: r.feature,
                summary: r.summary,
                quality: r.quality,
                data: r.data,
                processingTime: r.processing_time,
                model: r.model,
                createdAt: r.created_at
            })),
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit)
        };
    }

    async findHistoryByGenerationId(generationId, userId) {
        if (!this.isAvailable || !generationId) return null;

        let query = supabase
            .from('test_history')
            .select('*')
            .eq('generation_id', generationId);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query.maybeSingle();
        if (error) {
            logger.warn('Supabase findHistoryByGenerationId note:', error.message);
            return null;
        }

        if (!data) return null;

        return {
            _id: data.id,
            id: data.id,
            userId: data.user_id,
            generationId: data.generation_id,
            sessionId: data.session_id,
            requirement: data.requirement,
            feature: data.feature,
            summary: data.summary,
            quality: data.quality,
            data: data.data,
            createdAt: data.created_at
        };
    }

    // ==========================================
    // USERS (users)
    // ==========================================

    async findUserByEmail(email) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (error) {
            logger.error('Supabase findUserByEmail error:', error);
            throw error;
        }

        return data;
    }

    async findUserById(id) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            logger.error('Supabase findUserById error:', error);
            throw error;
        }

        return data;
    }

    async deleteUser(id) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');

        // Cascade delete auth sessions, workspace sessions, test history, and user record
        try {
            await supabase.from('auth_sessions').delete().eq('user_id', id);
        } catch (e) {
            logger.warn('Non-fatal: failed to delete auth_sessions for user', id);
        }

        try {
            await supabase.from('test_history').delete().eq('user_id', id);
        } catch (e) {
            logger.warn('Non-fatal: failed to delete test_history for user', id);
        }

        try {
            await supabase.from('workspace_sessions').delete().eq('user_id', id);
        } catch (e) {
            logger.warn('Non-fatal: failed to delete workspace_sessions for user', id);
        }

        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error('Supabase deleteUser error:', error);
            throw error;
        }

        return true;
    }

    async upsertOAuthUser({ email, name, avatar, provider = 'google' }) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');
        const now = new Date().toISOString();

        // 1-shot upsert on email
        const { data, error } = await supabase
            .from('users')
            .upsert({
                email,
                name: name || '',
                display_name: name || '',
                avatar: avatar || null,
                provider,
                is_verified: true,
                last_login: now
            }, { onConflict: 'email' })
            .select()
            .single();

        if (error) {
            logger.warn('Supabase upsertOAuthUser note, trying findUserByEmail:', error.message);
            const existing = await this.findUserByEmail(email);
            if (existing) return existing;
            throw error;
        }

        return data;
    }

    async createUser(userData) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');

        const { data, error } = await supabase
            .from('users')
            .insert({
                email: userData.email,
                password: userData.password || null,
                name: userData.name || '',
                display_name: userData.displayName || userData.name || '',
                avatar: userData.avatar || null,
                provider: userData.provider || 'email',
                is_verified: userData.isVerified || false,
                last_login: new Date().toISOString(),
                login_count: 1,
                total_tests_generated: 0,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            logger.error('Supabase createUser error:', error);
            throw error;
        }

        return data;
    }

    async updateUser(id, updates) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');

        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error('Supabase updateUser error:', error);
            throw error;
        }

        return data;
    }

    async updateProfile(id, { name, displayName, avatar }) {
        const payload = {};
        if (name !== undefined) payload.name = name;
        if (displayName !== undefined) payload.display_name = displayName;
        if (avatar !== undefined) payload.avatar = avatar;
        return this.updateUser(id, payload);
    }

    async updatePassword(id, hashedPassword) {
        const payload = {
            password: hashedPassword,
            password_changed_at: new Date().toISOString()
        };
        try {
            return await this.updateUser(id, payload);
        } catch (err) {
            // If password_changed_at column doesn't exist yet, retry with just password
            if (err.message && err.message.includes('password_changed_at')) {
                return await this.updateUser(id, { password: hashedPassword });
            }
            throw err;
        }
    }

    async setResetPasswordToken(email, tokenHash, expiresAt) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');

        try {
            const { data, error } = await supabase
                .from('users')
                .update({
                    reset_password_token: tokenHash,
                    reset_password_expire: expiresAt.toISOString()
                })
                .eq('email', email)
                .select()
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (err) {
            logger.warn('Supabase setResetPasswordToken: reset token columns may need migration in users table:', err.message);
            // Fallback to in-memory reset token storage
            this.inMemoryAuthSessions.set(`reset_${tokenHash}`, {
                email,
                expiresAt
            });
            return { email };
        }
    }

    async findUserByResetToken(tokenHash) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');

        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('reset_password_token', tokenHash)
                .gt('reset_password_expire', new Date().toISOString())
                .maybeSingle();

            if (error) throw error;
            if (data) return data;
        } catch (err) {
            logger.warn('Supabase findUserByResetToken note:', err.message);
        }

        // Check fallback in-memory reset token
        const cached = this.inMemoryAuthSessions.get(`reset_${tokenHash}`);
        if (cached && new Date(cached.expiresAt) > new Date()) {
            return await this.findUserByEmail(cached.email);
        }
        return null;
    }

    async clearResetPasswordToken(id) {
        if (!this.isAvailable) return;
        try {
            await supabase
                .from('users')
                .update({
                    reset_password_token: null,
                    reset_password_expire: null
                })
                .eq('id', id);
        } catch (err) {
            // Ignore if column doesn't exist
        }
    }

    // ==========================================
    // AUTH SESSIONS (auth_sessions)
    // ==========================================

    async createAuthSession({
        userId,
        sessionIdentifier,
        device = 'Unknown Device',
        browser = 'Unknown Browser',
        os = 'Unknown OS',
        userAgent = '',
        ipAddress = '',
        location = 'Unknown Location',
        expiresAt
    }) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const exp = expiresAt instanceof Date ? expiresAt.toISOString() : (expiresAt || new Date(Date.now() + 30 * 86400000).toISOString());

        if (this.isAvailable && this.authSessionsTableAvailable !== false) {
            try {
                const { data, error } = await supabase
                    .from('auth_sessions')
                    .insert({
                        id,
                        user_id: userId,
                        session_identifier: sessionIdentifier || crypto.randomBytes(24).toString('hex'),
                        device,
                        browser,
                        os,
                        user_agent: userAgent,
                        ip_address: ipAddress,
                        location,
                        last_active_at: now,
                        expires_at: exp,
                        created_at: now
                    })
                    .select()
                    .single();

                if (!error && data) {
                    this.authSessionsTableAvailable = true;
                    return this._formatAuthSession(data);
                }

                if (error && (error.code === '42P01' || error.message.includes('auth_sessions') || error.code === 'PGRST205')) {
                    this.authSessionsTableAvailable = false;
                    logger.info('ℹ️ Note: auth_sessions table not found in Supabase. Active sessions tracked in-memory.');
                }
            } catch (err) {
                this.authSessionsTableAvailable = false;
            }
        }

        // Graceful in-memory fallback
        const sessionObj = {
            id,
            _id: id,
            userId,
            sessionIdentifier: sessionIdentifier || crypto.randomBytes(24).toString('hex'),
            device,
            browser,
            os,
            userAgent,
            ipAddress,
            location,
            lastActiveAt: now,
            expiresAt: exp,
            revokedAt: null,
            createdAt: now
        };
        this.inMemoryAuthSessions.set(id, sessionObj);
        return sessionObj;
    }

    async getAuthSession(sessionId) {
        if (!sessionId) return null;

        if (this.isAvailable && this.authSessionsTableAvailable !== false) {
            try {
                const { data, error } = await supabase
                    .from('auth_sessions')
                    .select('*')
                    .eq('id', sessionId)
                    .maybeSingle();

                if (!error && data) {
                    return this._formatAuthSession(data);
                }
            } catch (err) {}
        }

        return this.inMemoryAuthSessions.get(sessionId) || null;
    }

    async listAuthSessions(userId) {
        if (!userId) return [];

        if (this.isAvailable && this.authSessionsTableAvailable !== false) {
            try {
                const { data, error } = await supabase
                    .from('auth_sessions')
                    .select('*')
                    .eq('user_id', userId)
                    .is('revoked_at', null)
                    .gt('expires_at', new Date().toISOString())
                    .order('last_active_at', { ascending: false });

                if (!error && data) {
                    return data.map(this._formatAuthSession);
                }
            } catch (err) {}
        }

        // In-memory filter
        const now = new Date();
        const results = [];
        for (const session of this.inMemoryAuthSessions.values()) {
            if (session.userId === userId && !session.revokedAt && new Date(session.expiresAt) > now) {
                results.push(session);
            }
        }
        return results.sort((a, b) => new Date(b.lastActiveAt) - new Date(a.lastActiveAt));
    }

    async revokeAuthSession(sessionId, userId) {
        if (!sessionId) return false;

        const now = new Date().toISOString();

        if (this.isAvailable && this.authSessionsTableAvailable !== false) {
            try {
                let query = supabase
                    .from('auth_sessions')
                    .update({ revoked_at: now })
                    .eq('id', sessionId);

                if (userId) {
                    query = query.eq('user_id', userId);
                }

                await query;
            } catch (err) {}
        }

        const mem = this.inMemoryAuthSessions.get(sessionId);
        if (mem && (!userId || mem.userId === userId)) {
            mem.revokedAt = now;
        }

        return true;
    }

    async revokeOtherAuthSessions(userId, currentSessionId) {
        if (!userId) return 0;
        const now = new Date().toISOString();
        let revokedCount = 0;

        if (this.isAvailable && this.authSessionsTableAvailable !== false) {
            try {
                let query = supabase
                    .from('auth_sessions')
                    .update({ revoked_at: now })
                    .eq('user_id', userId)
                    .is('revoked_at', null);

                if (currentSessionId) {
                    query = query.neq('id', currentSessionId);
                }

                const { data } = await query.select();
                if (data) revokedCount = data.length;
            } catch (err) {}
        }

        for (const [id, session] of this.inMemoryAuthSessions.entries()) {
            if (session.userId === userId && !session.revokedAt && id !== currentSessionId) {
                session.revokedAt = now;
                revokedCount++;
            }
        }

        return revokedCount;
    }

    async touchAuthSession(sessionId) {
        if (!sessionId) return;
        const now = new Date().toISOString();

        if (this.isAvailable && this.authSessionsTableAvailable !== false) {
            supabase
                .from('auth_sessions')
                .update({ last_active_at: now })
                .eq('id', sessionId)
                .then(() => {})
                .catch(() => {});
        }

        const mem = this.inMemoryAuthSessions.get(sessionId);
        if (mem) {
            mem.lastActiveAt = now;
        }
    }

    // ==========================================
    // TEST HISTORY (test_history)
    // ==========================================

    async saveTestHistory({
        userId,
        generationId,
        sessionId,
        requirement,
        appType = 'web',
        detailLevel = 'standard',
        testFocus = 'mixed',
        feature = '',
        summary = {},
        quality = {},
        data = {},
        processingTime = '',
        model = ''
    }) {
        if (!this.isAvailable) return null;
        try {
            const payload = {
                user_id: userId || null,
                generation_id: generationId || null,
                session_id: sessionId || null,
                requirement: requirement || '',
                app_type: appType,
                detail_level: detailLevel,
                test_focus: testFocus,
                feature: feature || '',
                summary: summary || {},
                quality: quality || {},
                data: data || {},
                processing_time: processingTime || '',
                model: model || '',
                created_at: new Date().toISOString()
            };
            const { data: inserted, error } = await supabase
                .from('test_history')
                .insert(payload)
                .select()
                .maybeSingle();

            if (error) {
                logger.warn('Supabase saveTestHistory error:', error.message);
                return null;
            }
            return this._formatTestHistory(inserted);
        } catch (err) {
            logger.warn('Supabase saveTestHistory exception:', err.message);
            return null;
        }
    }

    async getTestHistory(userId, { page = 1, limit = 20 } = {}) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('test_history')
            .select('*', { count: 'exact' });

        if (userId) {
            query = query.eq('user_id', userId);
        }

        query = query.order('created_at', { ascending: false });

        const { data, count, error } = await query.range(from, to);

        if (error) {
            logger.error('Supabase getTestHistory error:', error);
            throw error;
        }

        return {
            history: (data || []).map(row => this._formatTestHistory(row)),
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit)
        };
    }

    async findHistoryByGenerationId(generationId, userId) {
        if (!this.isAvailable || !generationId) return null;
        try {
            let query = supabase
                .from('test_history')
                .select('*')
                .eq('generation_id', generationId);

            if (userId) {
                query = query.eq('user_id', userId);
            }

            const { data, error } = await query.maybeSingle();
            if (error || !data) return null;
            return this._formatTestHistory(data);
        } catch (err) {
            return null;
        }
    }

    // ==========================================
    // HELPERS
    // ==========================================

    _formatTestHistory(row) {
        if (!row) return null;
        return {
            _id: row.id,
            id: row.id,
            userId: row.user_id,
            generationId: row.generation_id,
            sessionId: row.session_id,
            requirement: row.requirement || '',
            appType: row.app_type || 'web',
            detailLevel: row.detail_level || 'standard',
            testFocus: row.test_focus || 'mixed',
            feature: row.feature || 'Generated Suite',
            title: row.feature || 'Generated Suite',
            summary: row.summary || {},
            quality: row.quality || {},
            data: row.data || {},
            suite: row.data || {},
            processingTime: row.processing_time || '',
            model: row.model || '',
            createdAt: row.created_at,
            date: row.created_at
        };
    }

    _formatSession(row) {
        if (!row) return null;
        const summary = row.summary && typeof row.summary === 'object' ? { ...row.summary } : {};
        if (typeof summary.total !== 'number' || summary.total === 0) {
            const sum = (summary.functional || 0) +
                (summary.negative || 0) +
                (summary.edge || 0) +
                (summary.nonFunctional || 0) +
                (summary.apiChecklist || 0) +
                (summary.security || 0);
            if (sum > 0) {
                summary.total = sum;
            } else if (row.suite_data && typeof row.suite_data === 'object') {
                const sd = row.suite_data;
                const sdTotal = (sd.testCases?.length || 0) ||
                    (sd.tests?.length || 0) ||
                    ((sd.functional?.length || 0) +
                    (sd.negative?.length || 0) +
                    (sd.edge?.length || 0) +
                    (sd.nonFunctional?.length || 0) +
                    (sd.apiChecklist?.length || 0) +
                    (sd.security?.length || 0));
                if (sdTotal > 0) summary.total = sdTotal;
            }
        }

        return {
            _id: row.id,
            id: row.id,
            userId: row.user_id,
            title: row.title,
            status: row.status,
            requirement: row.requirement || row.raw_requirement || '',
            rawRequirement: row.raw_requirement || row.requirement || '',
            context: row.context || row.app_type || 'web',
            depth: row.depth || row.detail_level || 'standard',
            appType: row.app_type || row.context || 'web',
            detailLevel: row.detail_level || row.depth || 'standard',
            messages: row.messages || [],
            suiteData: row.suite_data || {},
            summary: summary,
            quality: row.quality || {},
            currentVersion: row.current_version || 1,
            versions: row.versions || [],
            generationId: row.generation_id || '',
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    _formatAuthSession(row) {
        if (!row) return null;
        return {
            _id: row.id,
            id: row.id,
            userId: row.user_id,
            sessionIdentifier: row.session_identifier,
            device: row.device,
            browser: row.browser,
            os: row.os,
            userAgent: row.user_agent,
            ipAddress: row.ip_address,
            location: row.location,
            lastActiveAt: row.last_active_at,
            expiresAt: row.expires_at,
            revokedAt: row.revoked_at,
            createdAt: row.created_at
        };
    }

    // ==========================================
    // WORKSPACES & WORKSPACE SETTINGS
    // ==========================================

    _formatWorkspace(row) {
        if (!row) return null;
        return {
            id: row.id,
            name: row.name,
            slug: row.slug || '',
            ownerId: row.owner_id || row.ownerId,
            defaultEnvironmentId: row.default_environment_id || row.defaultEnvironmentId || null,
            version: typeof row.version === 'number' ? row.version : 1,
            createdAt: row.created_at || row.createdAt,
            updatedAt: row.updated_at || row.updatedAt
        };
    }

    _formatWorkspaceMember(row) {
        if (!row) return null;
        return {
            id: row.id,
            workspaceId: row.workspace_id || row.workspaceId,
            userId: row.user_id || row.userId,
            role: row.role || 'member',
            status: row.status || 'active',
            createdAt: row.created_at || row.createdAt,
            updatedAt: row.updated_at || row.updatedAt
        };
    }

    _formatEnvironment(row) {
        if (!row) return null;
        return {
            id: row.id,
            workspaceId: row.workspace_id || row.workspaceId,
            name: row.name,
            slug: row.slug,
            baseUrl: row.base_url || row.baseUrl || '',
            isActive: row.is_active !== undefined ? Boolean(row.is_active) : (row.isActive !== undefined ? Boolean(row.isActive) : true),
            createdAt: row.created_at || row.createdAt,
            updatedAt: row.updated_at || row.updatedAt
        };
    }

    /**
     * Get or auto-provision the user's primary workspace
     */
    async getUserPrimaryWorkspace(userId, userName = '') {
        if (!userId) return null;

        // Try Supabase first if available
        if (this.isAvailable && this.workspacesTableAvailable !== false) {
            try {
                // Find active membership
                const { data: memberRows, error: memberErr } = await supabase
                    .from('workspace_members')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('status', 'active')
                    .limit(1);

                if (!memberErr && memberRows && memberRows.length > 0) {
                    const member = this._formatWorkspaceMember(memberRows[0]);
                    const { data: wsRow, error: wsErr } = await supabase
                        .from('workspaces')
                        .select('*')
                        .eq('id', member.workspaceId)
                        .maybeSingle();

                    if (!wsErr && wsRow) {
                        this.workspacesTableAvailable = true;
                        const ws = this._formatWorkspace(wsRow);
                        ws.role = member.role;
                        const memoryWs = this.inMemoryWorkspaces.get(member.workspaceId);
                        return memoryWs ? { ...ws, ...memoryWs, role: member.role } : ws;
                    }
                }

                if (memberErr && (memberErr.code === '42P01' || memberErr.message?.includes('workspace_members') || memberErr.code === 'PGRST205')) {
                    this.workspacesTableAvailable = false;
                }
            } catch (err) {
                this.workspacesTableAvailable = false;
            }
        }

        // Check in-memory membership
        for (const [key, mem] of this.inMemoryWorkspaceMembers.entries()) {
            if (mem.userId === userId && mem.status === 'active') {
                const ws = this.inMemoryWorkspaces.get(mem.workspaceId);
                if (ws) {
                    return { ...ws, role: mem.role };
                }
            }
        }

        // Auto-provision personal primary workspace for the user
        const wsId = 'ws_' + crypto.randomBytes(8).toString('hex');
        const now = new Date().toISOString();

        // Derive personalized workspace name (never shared or hardcoded 'Enterprise QA Core')
        let cleanName = (userName || '').trim();
        if (!cleanName && typeof userEmail === 'string' && userEmail.trim()) {
            cleanName = userEmail.split('@')[0];
        }
        if (!cleanName && this.isAvailable) {
            try {
                const { data: u } = await supabase
                    .from('users')
                    .select('name, display_name, email')
                    .eq('id', userId)
                    .maybeSingle();
                if (u) {
                    cleanName = (u.name || u.display_name || u.email?.split('@')[0] || '').trim();
                }
            } catch (e) {}
        }
        const wsName = cleanName ? `${cleanName}'s Workspace` : 'Personal Workspace';
        const wsSlug = cleanName ? cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'primary';

        // Multi-tenant policy:
        // Do NOT invent or seed fake environments (staging, production, localhost).
        // Environments must start empty until intentionally configured by workspace owner.
        const newWorkspace = {
            id: wsId,
            name: wsName,
            slug: wsSlug || 'primary',
            ownerId: userId,
            defaultEnvironmentId: null,
            version: 1,
            createdAt: now,
            updatedAt: now,
            role: 'owner'
        };

        const newMember = {
            id: crypto.randomUUID(),
            workspaceId: wsId,
            userId: userId,
            role: 'owner',
            status: 'active',
            createdAt: now,
            updatedAt: now
        };

        // Try persisting to Supabase if table is available
        if (this.isAvailable && this.workspacesTableAvailable !== false) {
            try {
                const { error: wsInsErr } = await supabase.from('workspaces').insert({
                    id: wsId,
                    name: wsName,
                    slug: wsSlug || 'primary',
                    owner_id: userId,
                    default_environment_id: null,
                    version: 1,
                    created_at: now,
                    updated_at: now
                });

                if (!wsInsErr) {
                    this.workspacesTableAvailable = true;
                    await supabase.from('workspace_members').insert({
                        id: newMember.id,
                        workspace_id: wsId,
                        user_id: userId,
                        role: 'owner',
                        status: 'active',
                        created_at: now,
                        updated_at: now
                    });

                    this.inMemoryWorkspaces.set(wsId, newWorkspace);
                    this.inMemoryWorkspaceMembers.set(`${wsId}_${userId}`, newMember);
                    this.inMemoryEnvironments.set(wsId, []);
                    this._saveDiskWorkspacesStore();

                    return newWorkspace;
                }
            } catch (e) {
                this.workspacesTableAvailable = false;
            }
        }

        // Store in memory and persist to disk store
        this.inMemoryWorkspaces.set(wsId, newWorkspace);
        this.inMemoryWorkspaceMembers.set(`${wsId}_${userId}`, newMember);
        this.inMemoryEnvironments.set(wsId, []);
        this._saveDiskWorkspacesStore();

        return newWorkspace;
    }

    /**
     * Verifies whether a given user has access to a specific workspace.
     */
    async verifyUserWorkspaceAccess(workspaceId, userId) {
        if (!workspaceId || !userId) return false;
        try {
            const primary = await this.getUserPrimaryWorkspace(userId);
            if (primary && (primary.id === workspaceId || primary._id === workspaceId)) {
                return true;
            }
            for (const mem of this.inMemoryWorkspaceMembers.values()) {
                if (mem.workspaceId === workspaceId && mem.userId === userId && mem.status === 'active') {
                    return true;
                }
            }
            if (this.isAvailable && this.workspacesTableAvailable !== false) {
                const { data } = await supabase
                    .from('workspace_members')
                    .select('id')
                    .eq('workspace_id', workspaceId)
                    .eq('user_id', userId)
                    .eq('status', 'active')
                    .maybeSingle();
                if (data) return true;
            }
        } catch (e) {
            logger.warn('verifyUserWorkspaceAccess check error:', e.message);
        }
        return false;
    }

    /**
     * Get a workspace by ID
     */
    async getWorkspace(workspaceId) {
        if (!workspaceId) return null;

        const memoryWs = this.inMemoryWorkspaces.get(workspaceId);

        if (this.isAvailable && this.workspacesTableAvailable !== false) {
            try {
                const { data, error } = await supabase
                    .from('workspaces')
                    .select('*')
                    .eq('id', workspaceId)
                    .maybeSingle();

                if (!error && data) {
                    const formatted = this._formatWorkspace(data);
                    if (memoryWs) {
                        return { ...formatted, ...memoryWs };
                    }
                    return formatted;
                }
            } catch (err) {}
        }

        return memoryWs ? { ...memoryWs } : null;
    }

    /**
     * Get user membership in a specific workspace
     */
    async getWorkspaceMembership(workspaceId, userId) {
        if (!workspaceId || !userId) return null;

        if (this.isAvailable && this.workspacesTableAvailable !== false) {
            try {
                const { data, error } = await supabase
                    .from('workspace_members')
                    .select('*')
                    .eq('workspace_id', workspaceId)
                    .eq('user_id', userId)
                    .maybeSingle();

                if (!error && data) {
                    return this._formatWorkspaceMember(data);
                }
            } catch (err) {}
        }

        const mem = this.inMemoryWorkspaceMembers.get(`${workspaceId}_${userId}`);
        return mem ? { ...mem } : null;
    }

    /**
     * List all active environments for a workspace
     */
    async getWorkspaceEnvironments(workspaceId) {
        if (!workspaceId) return [];

        if (this.isAvailable && this.workspacesTableAvailable !== false) {
            try {
                const { data, error } = await supabase
                    .from('workspace_environments')
                    .select('*')
                    .eq('workspace_id', workspaceId)
                    .eq('is_active', true)
                    .order('created_at', { ascending: true });

                if (!error && data && data.length > 0) {
                    return data.map(r => this._formatEnvironment(r));
                }
            } catch (err) {}
        }

        const envs = this.inMemoryEnvironments.get(workspaceId) || [];
        return envs.filter(e => e.isActive !== false);
    }

    /**
     * Get an environment by ID for a workspace
     */
    async getWorkspaceEnvironmentById(workspaceId, environmentId) {
        if (!workspaceId || !environmentId) return null;

        if (this.isAvailable && this.workspacesTableAvailable !== false) {
            try {
                const { data, error } = await supabase
                    .from('workspace_environments')
                    .select('*')
                    .eq('workspace_id', workspaceId)
                    .eq('id', environmentId)
                    .maybeSingle();

                if (!error && data) {
                    return this._formatEnvironment(data);
                }
            } catch (err) {}
        }

        const envs = this.inMemoryEnvironments.get(workspaceId) || [];
        const match = envs.find(e => e.id === environmentId);
        return match ? { ...match } : null;
    }

    /**
     * Create an environment for a workspace
     */
    async createWorkspaceEnvironment(workspaceId, envData = {}) {
        if (!workspaceId) throw new Error('Workspace ID is required');
        const envId = 'env_' + crypto.randomBytes(6).toString('hex');
        const now = new Date().toISOString();

        const newEnv = {
            id: envId,
            workspaceId,
            name: (envData.name || 'Custom Environment').trim(),
            slug: (envData.slug || envData.name || 'custom').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            baseUrl: envData.baseUrl || '',
            isActive: true,
            createdAt: now,
            updatedAt: now
        };

        if (this.isAvailable && this.workspacesTableAvailable !== false) {
            try {
                const { data, error } = await supabase.from('workspace_environments').insert({
                    id: newEnv.id,
                    workspace_id: workspaceId,
                    name: newEnv.name,
                    slug: newEnv.slug,
                    base_url: newEnv.baseUrl,
                    is_active: true,
                    created_at: now,
                    updated_at: now
                }).select().single();

                if (!error && data) {
                    const formatted = this._formatEnvironment(data);
                    const list = this.inMemoryEnvironments.get(workspaceId) || [];
                    list.push(formatted);
                    this.inMemoryEnvironments.set(workspaceId, list);
                    this._saveDiskWorkspacesStore();
                    return formatted;
                }
            } catch (err) {}
        }

        const list = this.inMemoryEnvironments.get(workspaceId) || [];
        list.push(newEnv);
        this.inMemoryEnvironments.set(workspaceId, list);
        this._saveDiskWorkspacesStore();
        return newEnv;
    }

    /**
     * Delete an environment from a workspace
     */
    async deleteWorkspaceEnvironment(workspaceId, environmentId) {
        if (!workspaceId || !environmentId) return false;

        if (this.isAvailable && this.workspacesTableAvailable !== false) {
            try {
                await supabase.from('workspace_environments').delete().eq('workspace_id', workspaceId).eq('id', environmentId);
            } catch (err) {}
        }

        const list = this.inMemoryEnvironments.get(workspaceId) || [];
        const filtered = list.filter(e => e.id !== environmentId);
        this.inMemoryEnvironments.set(workspaceId, filtered);

        // If defaultEnvironmentId was deleted, reset it on workspace
        const ws = this.inMemoryWorkspaces.get(workspaceId);
        if (ws && ws.defaultEnvironmentId === environmentId) {
            ws.defaultEnvironmentId = null;
            ws.version = (ws.version || 1) + 1;
            ws.updatedAt = new Date().toISOString();
        }
        this._saveDiskWorkspacesStore();
        return true;
    }

    /**
     * Update workspace settings with optimistic concurrency & audit trail
     */
    async updateWorkspaceSettings(workspaceId, updates = {}, actorId = null, auditMeta = {}) {
        if (!workspaceId) throw new Error('Workspace ID is required');

        const current = await this.getWorkspace(workspaceId);
        if (!current) {
            const err = new Error('Workspace not found');
            err.code = 'WORKSPACE_NOT_FOUND';
            throw err;
        }

        // Concurrency Check
        if (updates.expectedVersion !== undefined && updates.expectedVersion !== null) {
            if (Number(current.version) !== Number(updates.expectedVersion)) {
                const err = new Error('This workspace was modified by another administrator. Please reload to review the latest changes.');
                err.code = 'CONCURRENCY_CONFLICT';
                err.currentSettings = current;
                throw err;
            }
        }

        // Validate default environment if specified
        if (updates.defaultEnvironmentId !== undefined && updates.defaultEnvironmentId !== null) {
            const env = await this.getWorkspaceEnvironmentById(workspaceId, updates.defaultEnvironmentId);
            if (!env || !env.isActive) {
                const err = new Error('Selected default environment does not belong to this workspace or is inactive.');
                err.code = 'INVALID_ENVIRONMENT';
                throw err;
            }
        }

        const now = new Date().toISOString();
        const nextVersion = (current.version || 1) + 1;
        const newName = updates.name !== undefined ? updates.name.trim() : current.name;
        const newDefaultEnv = updates.defaultEnvironmentId !== undefined ? updates.defaultEnvironmentId : current.defaultEnvironmentId;

        // Track changes for audit log
        const changes = {};
        if (updates.name !== undefined && newName !== current.name) {
            changes.name = { from: current.name, to: newName };
        }
        if (updates.defaultEnvironmentId !== undefined && newDefaultEnv !== current.defaultEnvironmentId) {
            changes.defaultEnvironmentId = { from: current.defaultEnvironmentId, to: newDefaultEnv };
        }

        // Persist to Supabase if available
        if (this.isAvailable && this.workspacesTableAvailable !== false) {
            try {
                const { data, error } = await supabase
                    .from('workspaces')
                    .update({
                        name: newName,
                        default_environment_id: newDefaultEnv,
                        version: nextVersion,
                        updated_at: now
                    })
                    .eq('id', workspaceId)
                    .select()
                    .single();

                if (!error && data) {
                    await this.recordWorkspaceAuditLog({
                        workspaceId,
                        actorId,
                        action: 'workspace.settings.update',
                        changes,
                        ipAddress: auditMeta.ipAddress,
                        userAgent: auditMeta.userAgent
                    });
                    return this._formatWorkspace(data);
                }
            } catch (err) {}
        }

        // In-memory update and disk persist
        const updatedObj = {
            ...current,
            name: newName,
            defaultEnvironmentId: newDefaultEnv,
            version: nextVersion,
            updatedAt: now
        };
        this.inMemoryWorkspaces.set(workspaceId, updatedObj);
        this._saveDiskWorkspacesStore();

        await this.recordWorkspaceAuditLog({
            workspaceId,
            actorId,
            action: 'workspace.settings.update',
            changes,
            ipAddress: auditMeta.ipAddress,
            userAgent: auditMeta.userAgent
        });

        return updatedObj;
    }

    /**
     * Record an audit log entry for workspace modifications
     */
    async recordWorkspaceAuditLog({ workspaceId, actorId, action, changes = {}, ipAddress = '', userAgent = '' }) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        const logEntry = {
            id,
            workspace_id: workspaceId,
            actor_id: actorId || null,
            action,
            changes,
            ip_address: ipAddress || '',
            user_agent: userAgent || '',
            created_at: now
        };

        const formattedLog = {
            id,
            workspaceId,
            actorId,
            action,
            changes,
            ipAddress,
            userAgent,
            createdAt: now
        };

        this.inMemoryAuditLogs.push(formattedLog);

        if (this.isAvailable && this.workspacesTableAvailable !== false) {
            try {
                await supabase.from('workspace_audit_logs').insert(logEntry);
            } catch (err) {}
        }
    }

    /**
     * Add a member to a workspace (helper for testing and administration)
     */
    async addWorkspaceMember(param1, param2, param3, param4) {
        let workspaceId, userId, role = 'member', status = 'active';
        if (typeof param1 === 'object' && param1 !== null) {
            workspaceId = param1.workspaceId;
            userId = param1.userId;
            role = param1.role || 'member';
            status = param1.status || 'active';
        } else {
            workspaceId = param1;
            userId = param2;
            role = param3 || 'member';
            status = param4 || 'active';
        }

        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const memberObj = {
            id,
            workspaceId,
            userId,
            role,
            status,
            createdAt: now,
            updatedAt: now
        };

        this.inMemoryWorkspaceMembers.set(`${workspaceId}_${userId}`, memberObj);

        if (this.isAvailable && this.workspacesTableAvailable !== false) {
            try {
                await supabase.from('workspace_members').upsert({
                    id,
                    workspace_id: workspaceId,
                    user_id: userId,
                    role,
                    status,
                    created_at: now,
                    updated_at: now
                }, { onConflict: 'workspace_id,user_id' });
            } catch (err) {}
        }

        return memberObj;
    }

    /**
     * Get authoritative billing, quota, and usage metrics for a workspace
     */
    async getWorkspaceBilling(workspaceId, userId) {
        const workspace = await this.getWorkspace(workspaceId);
        if (!workspace) {
            const err = new Error('Workspace not found');
            err.code = 'WORKSPACE_NOT_FOUND';
            throw err;
        }

        const planId = workspace.plan || 'free';
        const billingInterval = workspace.billingInterval || 'monthly';
        const planStatus = workspace.planStatus || 'active';

        // Plan quota mappings
        const PLAN_QUOTAS = {
            free: 50,
            pro: 500,
            team: 2000,
            enterprise: 10000
        };

        const PLAN_SEATS = {
            free: 1,
            pro: 1,
            team: 5,
            enterprise: 25
        };

        const quota = PLAN_QUOTAS[planId] || 50;
        const seatsLimit = PLAN_SEATS[planId] || 1;

        // Current billing period calculation
        const now = new Date();
        const startOfMonth = new Date(Date.now());
        startOfMonth.setUTCDate(1);
        startOfMonth.setUTCHours(0, 0, 0, 0);

        const endOfMonth = new Date(Date.now());
        endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1);
        endOfMonth.setUTCDate(0);
        endOfMonth.setUTCHours(23, 59, 59, 999);

        const diffTime = endOfMonth.getTime() - now.getTime();
        const daysRemaining = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

        // Get actual usage count for this user or workspace
        let usedGenerations = typeof workspace.usedGenerations === 'number' ? workspace.usedGenerations : 0;
        let lifetimeTestCases = 0;

        if (userId && usedGenerations === 0) {
            try {
                const user = await this.findUserById(userId);
                if (user) {
                    lifetimeTestCases = user.total_tests_generated || 0;
                }
            } catch (err) {}
        }

        // Count test history records created this cycle
        if (this.isAvailable && typeof workspace.usedGenerations !== 'number') {
            try {
                let query = supabase
                    .from('test_history')
                    .select('id, summary', { count: 'exact' })
                    .gte('created_at', startOfMonth.toISOString())
                    .lte('created_at', endOfMonth.toISOString());

                if (userId) query = query.eq('user_id', userId);

                const { count } = await query;
                if (count !== null && count !== undefined) {
                    usedGenerations = count;
                }
            } catch (err) {}
        }

        // Fallback: estimate from lifetime if period count is 0
        if (usedGenerations === 0 && lifetimeTestCases > 0) {
            usedGenerations = Math.min(quota, Math.max(1, Math.round(lifetimeTestCases / 15)));
        }

        const remainingGenerations = Math.max(0, quota - usedGenerations);
        const usagePercent = Math.min(100, Math.round((usedGenerations / quota) * 100));

        // Environments count
        const environments = await this.getWorkspaceEnvironments(workspaceId);

        // Members count
        let memberCount = 1;
        for (const [key] of this.inMemoryWorkspaceMembers.entries()) {
            if (key.startsWith(`${workspaceId}_`)) memberCount++;
        }

        return {
            workspaceId,
            plan: planId,
            status: planStatus,
            billingInterval,
            quota,
            usedGenerations,
            remainingGenerations,
            usagePercent,
            seatsLimit,
            activeSeats: Math.min(seatsLimit, memberCount),
            currentPeriodStart: startOfMonth.toISOString(),
            currentPeriodEnd: endOfMonth.toISOString(),
            daysRemaining,
            meteredMetrics: {
                activeEnvironments: environments.length,
                lifetimeTestCases,
                workspaceMembers: memberCount,
                generationQuota: quota
            },
            invoices: workspace.invoices || [],
            paymentMethod: workspace.paymentMethod || null
        };
    }

    /**
     * Update workspace subscription plan with validation and audit logging
     */
    async updateWorkspacePlan(workspaceId, { plan, interval = 'monthly' }, actorId, auditMeta = {}) {
        const allowedPlans = ['free', 'pro', 'team', 'enterprise'];
        const allowedIntervals = ['monthly', 'annual'];

        const cleanPlan = (plan || '').toLowerCase().trim();
        const cleanInterval = (interval || 'monthly').toLowerCase().trim();

        if (!allowedPlans.includes(cleanPlan)) {
            const err = new Error(`Invalid plan "${plan}". Allowed plans: ${allowedPlans.join(', ')}.`);
            err.code = 'INVALID_PLAN';
            throw err;
        }

        if (!allowedIntervals.includes(cleanInterval)) {
            const err = new Error(`Invalid billing interval "${interval}". Allowed intervals: monthly, annual.`);
            err.code = 'INVALID_INTERVAL';
            throw err;
        }

        const current = await this.getWorkspace(workspaceId);
        if (!current) {
            const err = new Error('Workspace not found');
            err.code = 'WORKSPACE_NOT_FOUND';
            throw err;
        }

        const prevPlan = current.plan || 'free';
        const prevInterval = current.billingInterval || 'monthly';
        const now = new Date().toISOString();

        current.plan = cleanPlan;
        current.billingInterval = cleanInterval;
        current.planUpdatedAt = now;
        current.updatedAt = now;

        // Record a mock transaction invoice if moving to paid plan
        if (cleanPlan !== 'free' && prevPlan === 'free') {
            const invoiceRef = 'INV-' + now.slice(0, 7).replace('-', '') + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
            const prices = {
                pro: cleanInterval === 'annual' ? '$288.00' : '$29.00',
                team: cleanInterval === 'annual' ? '$948.00' : '$99.00',
                enterprise: 'Custom Agreement'
            };

            const newInvoice = {
                id: crypto.randomUUID(),
                reference: invoiceRef,
                date: now,
                description: `${cleanPlan.toUpperCase()} Plan — ${cleanInterval === 'annual' ? 'Annual Prepaid' : 'Monthly Cycle'}`,
                amount: prices[cleanPlan] || '$29.00',
                status: 'paid'
            };

            current.invoices = [newInvoice, ...(current.invoices || [])];
        }

        this.inMemoryWorkspaces.set(workspaceId, current);
        this._saveDiskWorkspacesStore();

        // Audit log
        await this.recordWorkspaceAuditLog({
            workspaceId,
            actorId,
            action: 'workspace.plan.update',
            changes: {
                plan: { from: prevPlan, to: cleanPlan },
                billingInterval: { from: prevInterval, to: cleanInterval }
            },
            ipAddress: auditMeta.ipAddress || '',
            userAgent: auditMeta.userAgent || ''
        });

        return await this.getWorkspaceBilling(workspaceId, actorId);
    }
}

module.exports = new SupabaseDataService();
