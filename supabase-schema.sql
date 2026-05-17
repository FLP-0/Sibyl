-- ─────────────────────────────────────────
-- SIBYL — Schéma base de données V1
-- À exécuter dans Supabase SQL Editor
-- ─────────────────────────────────────────

-- 1. PROFILS (extension de auth.users)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  pseudo      text unique not null,
  avatar_url  text,
  xp          integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Créer automatiquement un profil à chaque inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, pseudo)
  values (new.id, new.raw_user_meta_data->>'pseudo');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 2. POSTS
create table public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  content     text not null,
  image_url   text,
  created_at  timestamptz not null default now()
);


-- 3. RÉACTIONS
create table public.reactions (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null default 'like',
  created_at  timestamptz not null default now(),
  unique (post_id, user_id)
);


-- 4. INVITATIONS
create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  invited_by  uuid references public.profiles(id) on delete set null,
  used_by     uuid references public.profiles(id) on delete set null,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  status      text not null default 'pending' check (status in ('pending', 'used', 'expired')),
  created_at  timestamptz not null default now()
);


-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────

alter table public.profiles   enable row level security;
alter table public.posts       enable row level security;
alter table public.reactions   enable row level security;
alter table public.invitations enable row level security;

-- Profils : visibles par tous les membres, modifiables uniquement par le propriétaire
create policy "Profils visibles par les membres"
  on public.profiles for select
  to authenticated using (true);

create policy "Profil modifiable par son propriétaire"
  on public.profiles for update
  to authenticated using (auth.uid() = id);

-- Posts : visibles et créables par les membres
create policy "Posts visibles par les membres"
  on public.posts for select
  to authenticated using (true);

create policy "Posts créables par les membres"
  on public.posts for insert
  to authenticated with check (auth.uid() = author_id);

create policy "Posts supprimables par leur auteur"
  on public.posts for delete
  to authenticated using (auth.uid() = author_id);

-- Réactions : visibles et gérables par les membres
create policy "Réactions visibles par les membres"
  on public.reactions for select
  to authenticated using (true);

create policy "Réactions créables par les membres"
  on public.reactions for insert
  to authenticated with check (auth.uid() = user_id);

create policy "Réactions supprimables par leur auteur"
  on public.reactions for delete
  to authenticated using (auth.uid() = user_id);

-- Invitations : visibles uniquement par l'invitant et l'admin
create policy "Invitations visibles par leur créateur"
  on public.invitations for select
  to authenticated using (auth.uid() = invited_by);
