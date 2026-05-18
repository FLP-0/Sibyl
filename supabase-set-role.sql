create or replace function public.set_member_role(
  p_space_id uuid,
  p_user_id  uuid,
  p_role     text
) returns void as $func$
declare
  caller_role          text;
  caller_is_superadmin boolean;
begin
  select sm.role into caller_role
  from public.space_members sm
  where sm.space_id = p_space_id and sm.user_id = auth.uid();

  select is_superadmin into caller_is_superadmin
  from public.profiles
  where id = auth.uid();

  if (caller_role is distinct from 'admin') and (caller_is_superadmin is not true) then
    raise exception 'Unauthorized';
  end if;

  update public.space_members
  set role = p_role
  where space_id = p_space_id and user_id = p_user_id;
end;
$func$ language plpgsql security definer;

grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
