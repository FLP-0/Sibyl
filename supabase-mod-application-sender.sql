-- ─────────────────────────────────────────
-- SIBYL — Rôle de l'expéditeur sur les candidatures modérateur
-- À exécuter après supabase-mod-application-decisions.sql
-- ─────────────────────────────────────────

-- Distingue le Fondateur d'un admin d'espace dans l'affichage des réponses :
--   'founder'   → réponse du fondateur (couronne ♔)
--   'admin'     → réponse d'un admin de l'espace (pas de couronne)
--   'moderator' → réponse d'un modérateur (pas de couronne)
--   null        → message de l'utilisateur candidat / ancien message
alter table public.mod_applications
  add column if not exists sender_role text;
