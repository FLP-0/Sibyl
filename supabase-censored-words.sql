-- ─────────────────────────────────────────
-- SIBYL — Liste de mots censurés par espace
-- Partagée entre tous les mods d'un même espace
-- ─────────────────────────────────────────

create table public.censored_words (
  id          uuid        primary key default gen_random_uuid(),
  space_id    uuid        not null references public.spaces(id) on delete cascade,
  word        text        not null,
  added_by    uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (space_id, word)   -- pas de doublons par espace
);

alter table public.censored_words enable row level security;

-- Tous les membres peuvent lire (pour le check côté client)
create policy "censored_select" on public.censored_words for select
  using (
    space_id in (
      select space_id from public.space_members
      where user_id = auth.uid()
    )
  );

-- Seuls mods et admins peuvent ajouter
create policy "censored_insert" on public.censored_words for insert
  with check (
    added_by = auth.uid()
    and exists (
      select 1 from public.space_members sm
      where sm.space_id = censored_words.space_id
        and sm.user_id = auth.uid()
        and sm.role in ('moderator', 'admin')
    )
  );

-- Seuls mods et admins peuvent supprimer
create policy "censored_delete" on public.censored_words for delete
  using (
    exists (
      select 1 from public.space_members sm
      where sm.space_id = censored_words.space_id
        and sm.user_id = auth.uid()
        and sm.role in ('moderator', 'admin')
    )
  );
