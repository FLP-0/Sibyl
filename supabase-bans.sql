-- Table des bannissements
create table public.bans (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  space_id     uuid        not null references public.spaces(id) on delete cascade,
  banned_by    uuid        not null references auth.users(id),
  banned_until timestamptz,           -- NULL = définitif
  created_at   timestamptz not null default now(),
  unique(user_id, space_id)
);

alter table public.bans enable row level security;

-- Membres de l'espace peuvent lire les bans (pour vérifier leur propre statut)
create policy "bans_select" on public.bans for select using (
  exists (
    select 1 from public.space_members sm
    where sm.space_id = bans.space_id and sm.user_id = auth.uid()
  )
);

-- Modérateurs et admins peuvent bannir
create policy "bans_insert" on public.bans for insert with check (
  exists (
    select 1 from public.space_members sm
    where sm.space_id = bans.space_id
      and sm.user_id = auth.uid()
      and sm.role in ('moderator', 'admin')
  )
);

-- Modérateurs et admins peuvent lever un ban
create policy "bans_delete" on public.bans for delete using (
  exists (
    select 1 from public.space_members sm
    where sm.space_id = bans.space_id
      and sm.user_id = auth.uid()
      and sm.role in ('moderator', 'admin')
  )
);

-- Upsert (modifier un ban existant)
create policy "bans_update" on public.bans for update using (
  exists (
    select 1 from public.space_members sm
    where sm.space_id = bans.space_id
      and sm.user_id = auth.uid()
      and sm.role in ('moderator', 'admin')
  )
);
