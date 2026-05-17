-- Canal de discussion privé pour le staff (mods + admins)
create table public.staff_messages (
  id          uuid        primary key default gen_random_uuid(),
  space_id    uuid        not null references public.spaces(id) on delete cascade,
  author_id   uuid        not null references auth.users(id) on delete cascade,
  content     text        not null,
  created_at  timestamptz not null default now()
);

alter table public.staff_messages enable row level security;

-- Seuls les mods et admins peuvent lire
create policy "staff_msg_select" on public.staff_messages for select using (
  exists (
    select 1 from public.space_members sm
    where sm.space_id = staff_messages.space_id
      and sm.user_id = auth.uid()
      and sm.role in ('moderator', 'admin')
  )
);

-- Seuls les mods et admins peuvent écrire
create policy "staff_msg_insert" on public.staff_messages for insert with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.space_members sm
    where sm.space_id = staff_messages.space_id
      and sm.user_id = auth.uid()
      and sm.role in ('moderator', 'admin')
  )
);
