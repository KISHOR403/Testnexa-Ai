const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Supabase Data Service
 * Provides full database operations for Testnexa AI on Supabase PostgreSQL.
 */
class SupabaseDataService {
    get isAvailable() {
        return Boolean(supabase);
    }

    // ==========================================
    // SESSIONS
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

    async listSessions({ userId, page = 1, limit = 20, status, search, sort = 'updatedAt' }) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('workspace_sessions')
            .select('id, user_id, title, status, raw_requirement, requirement, context, depth, app_type, detail_level, summary, quality, current_version, created_at, updated_at', { count: 'exact' });

        if (userId) {
            query = query.eq('user_id', userId);
        }

        if (status) {
            query = query.eq('status', status);
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
            sessions: (data || []).map(this._formatSession),
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
    // TEST HISTORY
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

    async getTestHistory(userId, limit = 20) {
        if (!this.isAvailable) throw new Error('Supabase client is not available');

        const { data, error } = await supabase
            .from('test_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            logger.error('Supabase getTestHistory error:', error);
            throw error;
        }

        return data || [];
    }

    // ==========================================
    // USERS
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

    // Format snake_case SQL results to camelCase matching frontend expectations
    _formatSession(row) {
        if (!row) return null;
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
            summary: row.summary || {},
            quality: row.quality || {},
            currentVersion: row.current_version || 1,
            versions: row.versions || [],
            generationId: row.generation_id || '',
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}

module.exports = new SupabaseDataService();
