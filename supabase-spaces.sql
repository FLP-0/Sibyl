-- ─────────────────────────────────────────
-- SIBYL — Ajout des espaces (spaces)
-- À exécuter après supabase-schema.sql
-- ─────────────────────────────────────────

-- 1. TABLE ESPACES
create table public.spaces (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  code         text unique not null,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- 2. MEMBRES PAR ESPACE
create table public.space_members (
  space_id    uuid not null references public.spaces(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'member' check (role in ('member', 'moderator', 'admin')),
  joined_at   timestamptz not null default now(),
  primary key (space_id, user_id)
);

-- 3. RATTACHER LES POSTS À UN ESPACE
alter table public.posts
  add column space_id uuid references public.spaces(id) on delete cascade;

-- 4. CRÉER L'ESPACE SIBYL PAR DÉFAUT
-- Le code est un nombre aléatoire à 6 chiffres
insert into public.spaces (name, description, code)
values (
  'Sibyl',
  'La communauté originelle.',
  lpad(floor(random() * 1000000)::text, 6, '0')
);


-- ─────────────────────────────────────────
-- RLS — Espaces
-- ─────────────────────────────────────────

alter table public.spaces        enable row level security;
alter table public.space_members enable row level security;

-- Espaces visibles par les membres qui y appartiennent
create policy "Espaces visibles par leurs membres"
  on public.spaces for select
  to authenticated
  using (
    id in (
      select space_id from public.space_members
      where user_id = auth.uid()
    )
  );

-- Membres visibles au sein d'un même espace
create policy "Membres visibles dans l'espace"
  on public.space_members for select
  to authenticated
  using (
    space_id in (
      select space_id from public.space_members
      where user_id = auth.uid()
    )
  );

-- Rejoindre un espace (insert)
create policy "Rejoindre un espace"
  on public.space_members for insert
  to authenticated
  with check (auth.uid() = user_id);
