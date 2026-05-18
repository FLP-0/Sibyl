create table public.access_requests (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references public.spaces(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique(space_id, user_id)
);

alter table public.access_requests enable row level security;

create policy "Voir ses propres demandes" on public.access_requests
  for select to authenticated using (user_id = auth.uid());

create policy "Admins voient les demandes" on public.access_requests
  for select to authenticated using (
    space_id in (
      select space_id from public.space_members
      where user_id = auth.uid() and role = 'admin'
    )
    or (select is_superadmin from public.profiles where id = auth.uid()) = true
  );

create policy "Creer une demande" on public.access_requests
  for insert to authenticated with check (user_id = auth.uid());

create policy "Mettre a jour sa demande" on public.access_requests
  for update to authenticated using (user_id = auth.uid());

create or replace function public.approve_access_request(p_request_id uuid)
returns void as $func$
declare
  req                  record;
  caller_role          text;
  caller_is_superadmin boolean;
begin
  select * into req from public.access_requests where id = p_request_id;
  if not found then raise exception 'Demande introuvable'; end if;

  select sm.role into caller_role
  from public.space_members sm
  where sm.space_id = req.space_id and sm.user_id = auth.uid();

  select is_superadmin into caller_is_superadmin
  from public.profiles where id = auth.uid();

  if (caller_role is distinct from 'admin') and (caller_is_superadmin is not true) then
    raise exception 'Unauthorized';
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (req.space_id, req.user_id, 'member')
  on conflict (space_id, user_id) do update set role = 'member';

  update public.access_requests set status = 'approved' where id = p_request_id;
end;
$func$ language plpgsql security definer;

grant execute on function public.approve_access_request(uuid) to authenticated;

create or replace function public.reject_access_request(p_request_id uuid)
returns void as $func$
declare
  req                  record;
  caller_role          text;
  caller_is_superadmin boolean;
begin
  select * into req from public.access_requests where id = p_request_id;
  if not found then raise exception 'Demande introuvable'; end if;

  select sm.role into caller_role
  from public.space_members sm
  where sm.space_id = req.space_id and sm.user_id = auth.uid();

  select is_superadmin into caller_is_superadmin
  from public.profiles where id = auth.uid();

  if (caller_role is distinct from 'admin') and (caller_is_superadmin is not true) then
    raise exception 'Unauthorized';
  end if;

  update public.access_requests set status = 'rejected' where id = p_request_id;
end;
$func$ language plpgsql security definer;

grant execute on function public.reject_access_request(uuid) to authenticated;
