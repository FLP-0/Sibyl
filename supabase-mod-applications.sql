-- Table des messages de candidature modérateur
create table public.mod_applications (
  id          uuid        primary key default gen_random_uuid(),
  space_id    uuid        not null references public.spaces(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  content     text        not null,
  from_owner  boolean     not null default false,
  created_at  timestamptz not null default now()
);

alter table public.mod_applications enable row level security;

-- Un membre peut lire ses propres messages, un admin peut tout lire
create policy "modapps_select" on public.mod_applications for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.space_members sm
    where sm.space_id = mod_applications.space_id
      and sm.user_id = auth.uid()
      and sm.role = 'admin'
  )
);

-- Un membre peut envoyer ses propres messages (from_owner = false)
create policy "modapps_user_insert" on public.mod_applications for insert with check (
  user_id = auth.uid() and not from_owner
);

-- Un admin peut répondre (from_owner = true)
create policy "modapps_admin_insert" on public.mod_applications for insert with check (
  from_owner = true
  and exists (
    select 1 from public.space_members sm
    where sm.space_id = mod_applications.space_id
      and sm.user_id = auth.uid()
      and sm.role = 'admin'
  )
);
