const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * Supabase Data Service
 * Provides full database operations for Testnexa AI on Supabase PostgreSQL.
 * Serves as the authoritative and permanent persistence layer.
 */
class SupabaseDataService {
    constructor() {
        this.inMemoryAuthSessions = new Map();
        this.authSessionsTableAvailable = null; // null = untested, true/false
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
}

module.exports = new SupabaseDataService();
