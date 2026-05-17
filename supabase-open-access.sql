-- ─────────────────────────────────────────
-- SIBYL — Accès libre par sésame (open_access)
-- ─────────────────────────────────────────

-- 1. Colonne open_access sur spaces
alter table public.spaces
  add column if not exists open_access boolean not null default false;

-- 2. Permettre aux admins de modifier leur espace
create policy "Espace modifiable par ses admins"
  on public.spaces for update
  to authenticated
  using (
    id in (
      select space_id from public.space_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- 3. Mettre à jour la RPC pour exposer open_access
--    (security definer → bypass RLS → accessible sans être membre)
create or replace function public.get_space_by_code(input_code text)
returns table(id uuid, name text, open_access boolean) as $$
  select id, name, open_access
  from public.spaces
  where code = input_code
  limit 1;
$$ language sql security definer stable;

grant execute on function public.get_space_by_code(text) to anon;
