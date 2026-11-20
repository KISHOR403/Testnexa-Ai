-- ==============================================================================
-- Migration Down: 010_recommendations_schema_down.sql
-- Description: Reverts migration 010 by dropping recommendation intelligence tables.
-- ==============================================================================

DROP TABLE IF EXISTS public.recommendation_actions CASCADE;
DROP TABLE IF EXISTS public.recommendations CASCADE;
DROP TABLE IF EXISTS public.coverage_analyses CASCADE;
