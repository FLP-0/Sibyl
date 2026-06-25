-- ─────────────────────────────────────────
-- SIBYL — Mode maintenance par espace
-- À exécuter après supabase-spaces.sql et supabase-open-access.sql
-- ─────────────────────────────────────────

-- 1. Colonnes maintenance sur spaces
alter table public.spaces
  add column if not exists maintenance_mode    boolean not null default false,
  add column if not exists maintenance_message text;

-- 2. Activer la Realtime publication pour que les clients soient notifiés
--    en temps réel quand maintenance_mode change
alter publication supabase_realtime add table public.spaces;
