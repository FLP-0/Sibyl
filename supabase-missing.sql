-- ─────────────────────────────────────────
-- SIBYL — Corrections et colonnes manquantes
-- À exécuter dans Supabase SQL Editor
-- Ordre : après supabase-spaces.sql
-- ─────────────────────────────────────────


-- ─────────────────────────────────────────
-- 1. COLONNES MANQUANTES SUR PROFILES
-- ─────────────────────────────────────────

alter table public.profiles
  add column if not exists is_superadmin boolean not null default false,
  add column if not exists bio           text;


-- ─────────────────────────────────────────
-- 2. COLONNE MANQUANTE SUR POSTS
-- ─────────────────────────────────────────

alter table public.posts
  add column if not exists pinned boolean not null default false;


-- ─────────────────────────────────────────
-- 3. TABLE MESSAGES (chat temps réel)
-- ─────────────────────────────────────────

create table if not exists public.messages (
  id          uuid        primary key default gen_random_uuid(),
  space_id    uuid        not null references public.spaces(id) on delete cascade,
  author_id   uuid        not null references auth.users(id)   on delete cascade,
  content     text        not null,
  created_at  timestamptz not null default now()
);

alter table public.messages enable row level security;

-- Seuls les membres de l'espace peuvent lire les messages
create policy "Messages visibles par les membres de l'espace"
  on public.messages for select
  to authenticated
  using (
    space_id in (
      select space_id from public.space_members
      where user_id = auth.uid()
    )
  );

-- Seuls les membres non bannis peuvent écrire
-- (le ban est géré côté client + RLS bans ; pas de check ici pour éviter une dépendance circulaire)
create policy "Messages créables par les membres de l'espace"
  on public.messages for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and space_id in (
      select space_id from public.space_members
      where user_id = auth.uid()
    )
  );

-- Admins et mods peuvent supprimer des messages
create policy "Messages supprimables par les modérateurs"
  on public.messages for delete
  to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.space_members sm
      where sm.space_id = messages.space_id
        and sm.user_id = auth.uid()
        and sm.role in ('moderator', 'admin')
    )
  );


-- ─────────────────────────────────────────
-- 4. CORRECTION RLS POSTS — filtrer par espace
-- ─────────────────────────────────────────

-- Supprimer l'ancienne politique trop permissive
drop policy if exists "Posts visibles par les membres" on public.posts;

-- Remplacer par une politique filtrée sur l'espace
create policy "Posts visibles par les membres de l'espace"
  on public.posts for select
  to authenticated
  using (
    space_id in (
      select space_id from public.space_members
      where user_id = auth.uid()
    )
  );

-- S'assurer que l'insert est aussi limité à l'espace
drop policy if exists "Posts créables par les membres" on public.posts;

create policy "Posts créables par les membres de l'espace"
  on public.posts for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and space_id in (
      select space_id from public.space_members
      where user_id = auth.uid()
    )
  );

-- Admins et mods peuvent supprimer des posts (en plus de l'auteur)
drop policy if exists "Posts supprimables par leur auteur" on public.posts;

create policy "Posts supprimables par auteur ou modérateurs"
  on public.posts for delete
  to authenticated
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.space_members sm
      where sm.space_id = posts.space_id
        and sm.user_id = auth.uid()
        and sm.role in ('moderator', 'admin')
    )
  );

-- Admins et mods peuvent épingler (update pinned)
create policy "Posts modifiables par les modérateurs"
  on public.posts for update
  to authenticated
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.space_members sm
      where sm.space_id = posts.space_id
        and sm.user_id = auth.uid()
        and sm.role in ('moderator', 'admin')
    )
  );


-- ─────────────────────────────────────────
-- 5. FONCTION RPC get_space_members
-- ─────────────────────────────────────────

create or replace function public.get_space_members(p_space_id uuid)
returns table(
  user_id   uuid,
  role      text,
  joined_at timestamptz,
  pseudo    text,
  bio       text
)
language sql
security definer
stable
as $$
  select
    sm.user_id,
    sm.role,
    sm.joined_at,
    p.pseudo,
    p.bio
  from public.space_members sm
  join public.profiles p on p.id = sm.user_id
  where sm.space_id = p_space_id
  order by
    case sm.role
      when 'admin'     then 1
      when 'moderator' then 2
      else                  3
    end,
    sm.joined_at asc;
$$;

-- Accessible aux membres authentifiés
grant execute on function public.get_space_members(uuid) to authenticated;
