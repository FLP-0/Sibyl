-- Colonne titre sur les posts
alter table public.posts add column if not exists title text;

-- Table des réponses aux posts
create table if not exists public.replies (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  space_id   uuid not null references public.spaces(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

alter table public.replies enable row level security;

create policy if not exists "Voir les réponses"
  on public.replies for select
  to authenticated
  using (true);

create policy if not exists "Écrire une réponse"
  on public.replies for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.space_members
      where space_id = replies.space_id and user_id = auth.uid()
    )
  );

create policy if not exists "Supprimer sa réponse"
  on public.replies for delete
  to authenticated
  using (author_id = auth.uid());
