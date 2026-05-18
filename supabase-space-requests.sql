-- Colonne allow_space_requests sur la table spaces
alter table public.spaces
  add column if not exists allow_space_requests boolean not null default false;

-- Table des demandes de création d'espace
create table if not exists public.space_requests (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references auth.users(id) on delete cascade,
  space_id      uuid not null references public.spaces(id) on delete cascade,
  name          text not null,
  description   text,
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now()
);

alter table public.space_requests enable row level security;

create policy if not exists "Voir ses propres demandes d'espace"
  on public.space_requests for select
  to authenticated
  using (requester_id = auth.uid());

create policy if not exists "Soumettre une demande d'espace"
  on public.space_requests for insert
  to authenticated
  with check (requester_id = auth.uid());
