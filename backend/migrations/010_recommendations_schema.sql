-- ==============================================================================
-- Migration 010: Smart Recommendations Schema & Coverage Intelligence
-- Authoritative schema for:
-- - AI-generated smart test scenario recommendations
-- - Deterministic coverage gap analyses per suite
-- - Recommendation lifecycle actions and audit trails
-- ==============================================================================

-- 1. COVERAGE ANALYSES TABLE
CREATE TABLE IF NOT EXISTS public.coverage_analyses (
    id VARCHAR(64) PRIMARY KEY,
    workspace_id VARCHAR(64) NULL,
    suite_id VARCHAR(64) NOT NULL REFERENCES public.workspace_sessions(id) ON DELETE CASCADE,
    suite_version INTEGER NOT NULL DEFAULT 1,
    total_requirements INTEGER NOT NULL DEFAULT 0,
    untested_requirements INTEGER NOT NULL DEFAULT 0,
    shallow_coverage_count INTEGER NOT NULL DEFAULT 0,
    gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by VARCHAR(64) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_coverage_analyses_suite_id ON public.coverage_analyses(suite_id);
CREATE INDEX IF NOT EXISTS idx_coverage_analyses_workspace_id ON public.coverage_analyses(workspace_id);
CREATE INDEX IF NOT EXISTS idx_coverage_analyses_created_at ON public.coverage_analyses(created_at DESC);

-- 2. SMART RECOMMENDATIONS TABLE
CREATE TABLE IF NOT EXISTS public.recommendations (
    id VARCHAR(64) PRIMARY KEY,
    workspace_id VARCHAR(64) NULL,
    project_id VARCHAR(64) NULL,
    suite_id VARCHAR(64) NOT NULL REFERENCES public.workspace_sessions(id) ON DELETE CASCADE,
    analysis_id VARCHAR(64) NULL REFERENCES public.coverage_analyses(id) ON DELETE SET NULL,
    requirement_id VARCHAR(100) NOT NULL,
    title TEXT NOT NULL,
    description TEXT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'Functional',
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
    reason TEXT NULL,
    why_this_test TEXT NULL,
    preconditions TEXT NULL,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    expected_result TEXT NULL,
    source_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    similar_test_case_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    similarity_status VARCHAR(20) NOT NULL DEFAULT 'distinct' CHECK (similarity_status IN ('distinct', 'similar', 'duplicate')),
    status VARCHAR(20) NOT NULL DEFAULT 'SUGGESTED' CHECK (status IN (
        'SUGGESTED',
        'ACCEPTED',
        'ADDED',
        'DISMISSED',
        'DUPLICATE',
        'EXPIRED'
    )),
    created_by VARCHAR(64) NULL,
    updated_by VARCHAR(64) NULL,
    resulting_test_case_id VARCHAR(64) NULL,
    suite_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance, multi-tenant isolation, and fast status queries
CREATE INDEX IF NOT EXISTS idx_recommendations_suite_id ON public.recommendations(suite_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_workspace_id ON public.recommendations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON public.recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON public.recommendations(priority);
CREATE INDEX IF NOT EXISTS idx_recommendations_category ON public.recommendations(category);
CREATE INDEX IF NOT EXISTS idx_recommendations_req_id ON public.recommendations(requirement_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_suite_status ON public.recommendations(suite_id, status);
CREATE INDEX IF NOT EXISTS idx_recommendations_suite_req ON public.recommendations(suite_id, requirement_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON public.recommendations(created_at DESC);

-- 3. RECOMMENDATION ACTIONS & AUDIT TABLE
CREATE TABLE IF NOT EXISTS public.recommendation_actions (
    id VARCHAR(64) PRIMARY KEY,
    recommendation_id VARCHAR(64) NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'generated', 'accepted', 'added', 'dismissed', 'edited', 'expired', 'undone'
    user_id VARCHAR(64) NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_recommendation_actions_rec_id ON public.recommendation_actions(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_actions_created_at ON public.recommendation_actions(created_at DESC);
