-- ==============================================================================
-- Testnexa AI - Supabase PostgreSQL Database Schema
-- Run this in your Supabase SQL Editor to set up or verify all tables.
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. USERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    name TEXT DEFAULT '',
    display_name TEXT DEFAULT '',
    avatar TEXT,
    provider TEXT DEFAULT 'email',
    is_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMPTZ DEFAULT NOW(),
    login_count INTEGER DEFAULT 0,
    total_tests_generated INTEGER DEFAULT 0,
    password_changed_at TIMESTAMPTZ,
    reset_password_token TEXT,
    reset_password_expire TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure optional columns exist if table was previously created with minimal columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reset_password_token TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reset_password_expire TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_tests_generated INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON public.users(reset_password_token);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- ------------------------------------------------------------------------------
-- 2. WORKSPACE SESSIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    generation_id TEXT,
    title TEXT DEFAULT 'Untitled Session',
    status TEXT DEFAULT 'Draft',
    app_type TEXT DEFAULT 'web',
    context TEXT DEFAULT 'web',
    depth TEXT DEFAULT 'Standard',
    detail_level TEXT DEFAULT 'Standard',
    test_focus TEXT DEFAULT 'mixed',
    raw_requirement TEXT DEFAULT '',
    requirement TEXT DEFAULT '',
    feature TEXT DEFAULT '',
    suite_data JSONB DEFAULT '{}'::jsonb,
    summary JSONB DEFAULT '{}'::jsonb,
    quality JSONB DEFAULT '{}'::jsonb,
    messages JSONB DEFAULT '[]'::jsonb,
    versions JSONB DEFAULT '[]'::jsonb,
    current_version INTEGER DEFAULT 1,
    model TEXT DEFAULT '',
    processing_time TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_sessions_user_id ON public.workspace_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_sessions_status ON public.workspace_sessions(status);
CREATE INDEX IF NOT EXISTS idx_workspace_sessions_updated_at ON public.workspace_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_sessions_generation_id ON public.workspace_sessions(generation_id);

-- ------------------------------------------------------------------------------
-- 3. TEST HISTORY TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_history (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    generation_id TEXT,
    session_id TEXT REFERENCES public.workspace_sessions(id) ON DELETE SET NULL,
    requirement TEXT DEFAULT '',
    app_type TEXT DEFAULT 'web',
    detail_level TEXT DEFAULT 'standard',
    test_focus TEXT DEFAULT 'mixed',
    feature TEXT DEFAULT '',
    summary JSONB DEFAULT '{}'::jsonb,
    quality JSONB DEFAULT '{}'::jsonb,
    data JSONB DEFAULT '{}'::jsonb,
    processing_time TEXT DEFAULT '',
    model TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_history_user_id ON public.test_history(user_id);
CREATE INDEX IF NOT EXISTS idx_test_history_generation_id ON public.test_history(generation_id);
CREATE INDEX IF NOT EXISTS idx_test_history_created_at ON public.test_history(created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. AUTH SESSIONS TABLE (Active login & device tracking)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_identifier TEXT,
    device TEXT DEFAULT 'Unknown Device',
    browser TEXT DEFAULT 'Unknown Browser',
    os TEXT DEFAULT 'Unknown OS',
    user_agent TEXT,
    ip_address TEXT,
    location TEXT DEFAULT 'Unknown Location',
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON public.auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON public.auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_revoked ON public.auth_sessions(revoked_at);

-- ------------------------------------------------------------------------------
-- 5. WORKSPACES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
    id TEXT PRIMARY KEY DEFAULT ('ws_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    name TEXT NOT NULL,
    slug TEXT,
    owner_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    default_environment_id TEXT,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_updated_at ON public.workspaces(updated_at DESC);

-- ------------------------------------------------------------------------------
-- 6. WORKSPACE MEMBERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws_user ON public.workspace_members(workspace_id, user_id);

-- ------------------------------------------------------------------------------
-- 7. WORKSPACE ENVIRONMENTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_environments (
    id TEXT PRIMARY KEY DEFAULT ('env_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12)),
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    base_url TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_workspace_env_slug UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_workspace_environments_ws ON public.workspace_environments(workspace_id);

-- Add foreign key constraint for default_environment_id if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_workspaces_default_env'
    ) THEN
        ALTER TABLE public.workspaces
        ADD CONSTRAINT fk_workspaces_default_env
        FOREIGN KEY (default_environment_id)
        REFERENCES public.workspace_environments(id)
        ON DELETE SET NULL;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 8. WORKSPACE AUDIT LOGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    actor_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    changes JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_audit_logs_ws ON public.workspace_audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_audit_logs_created ON public.workspace_audit_logs(created_at DESC);

-- ------------------------------------------------------------------------------
-- 9. SUITE SHARES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suite_shares (
    id TEXT PRIMARY KEY DEFAULT ('sh_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    suite_id TEXT NOT NULL REFERENCES public.workspace_sessions(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    share_token TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'reviewer', -- 'viewer', 'reviewer', 'editor'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'revoked'
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suite_shares_suite_id ON public.suite_shares(suite_id);
CREATE INDEX IF NOT EXISTS idx_suite_shares_token ON public.suite_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_suite_shares_owner_id ON public.suite_shares(owner_id);

-- ------------------------------------------------------------------------------
-- 10. ADMIN AUDIT LOGS TABLE (Append-Only Security Audit Trail)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    actor_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    actor_email TEXT,
    action TEXT NOT NULL,
    target_resource TEXT NOT NULL,
    outcome TEXT NOT NULL DEFAULT 'success',
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor ON public.admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON public.admin_audit_logs(created_at DESC);

-- ------------------------------------------------------------------------------
-- 11. GENERATION LOGS TABLE (AI Pipeline Telemetry & Error Tracking)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generation_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    request_id TEXT NOT NULL,
    user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    workspace_id TEXT,
    status TEXT NOT NULL, -- 'success', 'failed', 'running', 'quota_exceeded'
    processing_duration_ms INTEGER DEFAULT 0,
    app_type TEXT,
    detail_level TEXT,
    model TEXT,
    error_category TEXT,
    error_message TEXT,
    retries INTEGER DEFAULT 0,
    tests_generated INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_logs_user_id ON public.generation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_logs_status ON public.generation_logs(status);
CREATE INDEX IF NOT EXISTS idx_generation_logs_created_at ON public.generation_logs(created_at DESC);

-- ------------------------------------------------------------------------------
-- 12. PLATFORM SETTINGS TABLE (Configurable Feature Flags and Limits)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 13. SUPPORT TICKETS TABLE (Contact Inquiries and Platform Support)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id TEXT PRIMARY KEY DEFAULT ('TN-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new', -- 'new', 'in_progress', 'resolved', 'closed'
    priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    assigned_to TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    internal_notes JSONB DEFAULT '[]'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_email ON public.support_tickets(email);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON public.support_tickets(created_at DESC);



