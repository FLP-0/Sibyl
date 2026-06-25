-- ─────────────────────────────────────────
-- SIBYL — Décisions sur les candidatures modérateur
-- À exécuter après supabase-mod-applications.sql
-- ─────────────────────────────────────────

-- 1. Type de message : 'message' (normal), 'rejected' (refus), 'accepted' (acceptation)
alter table public.mod_applications
  add column if not exists kind text not null default 'message';

-- 2. Mise à jour des policies pour autoriser le fondateur (superadmin)
--    à lire et écrire dans tous les espaces, même s'il n'en est pas membre.
--    (nécessaire pour Refuser / Accepter depuis l'espace fondateur)

drop policy if exists "modapps_select" on public.mod_applications;
create policy "modapps_select" on public.mod_applications for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.space_members sm
    where sm.space_id = mod_applications.space_id
      and sm.user_id = auth.uid()
      and sm.role = 'admin'
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_superadmin is true
  )
);

drop policy if exists "modapps_admin_insert" on public.mod_applications;
create policy "modapps_admin_insert" on public.mod_applications for insert with check (
  from_owner = true
  and (
    exists (
      select 1 from public.space_members sm
      where sm.space_id = mod_applications.space_id
        and sm.user_id = auth.uid()
        and sm.role = 'admin'
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_superadmin is true
    )
  )
);
