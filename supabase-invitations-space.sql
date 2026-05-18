alter table public.invitations
  add column if not exists space_id uuid references public.spaces(id) on delete cascade;
