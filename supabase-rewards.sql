-- XP et niveau sur les profils
alter table public.profiles
  add column if not exists xp int not null default 0,
  add column if not exists level int not null default 0,
  add column if not exists last_xp_login date;

-- Définitions des badges
-- Les seuils de niveau sont définis dans le code : [0, 200, 700, 2000, 6000, 15000, 35000]
create table if not exists public.badges (
  id          text primary key,
  name        text not null,
  description text not null,
  icon        text not null,
  category    text not null check (category in ('publication', 'interaction', 'progression', 'prestige')),
  hidden      boolean not null default false
);

-- Badges débloqués par les utilisateurs
create table if not exists public.user_badges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  badge_id    text not null references public.badges(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique(user_id, badge_id)
);

alter table public.user_badges enable row level security;

create policy "Voir les badges"
  on public.user_badges for select
  to authenticated
  using (true);

-- Journal des gains XP
create table if not exists public.xp_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  action     text not null,
  amount     int not null,
  space_id   uuid references public.spaces(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.xp_logs enable row level security;

create policy "Voir ses XP logs"
  on public.xp_logs for select
  to authenticated
  using (user_id = auth.uid());

-- ─── Badges visibles ───
insert into public.badges (id, name, description, icon, category, hidden) values
  ('premier_souffle', 'Premier Souffle', 'Publier son premier post',       '✦', 'publication', false),
  ('echo',            'Écho',            'Publier 10 posts',               '◈', 'publication', false),
  ('orateur',         'Orateur',         'Publier 50 posts',               '❖', 'publication', false),
  ('premier_mot',     'Premier Mot',     'Envoyer son premier message',    '◇', 'interaction', false),
  ('bavard',          'Bavard',          'Envoyer 100 messages',           '◆', 'interaction', false),
  ('repondant',       'Répondant',       'Écrire 10 réponses',             '↩', 'interaction', false),
  ('dialoguiste',     'Dialoguiste',     'Écrire 50 réponses',             '⇄', 'interaction', false),
  ('resonance',       'Résonance',       'Recevoir 25 réactions',          '♦', 'prestige',    false),
  ('magnetisme',      'Magnétisme',      'Recevoir 100 réactions',         '★', 'prestige',    false),
  ('eveille',         'Éveillé',         'Atteindre le niveau 1',          '◉', 'progression', false),
  ('adepte',          'Adepte',          'Atteindre le niveau 3',          '⬡', 'progression', false),
  ('oracle',          'Oracle',          'Atteindre le niveau 6',          '⟁', 'progression', false),

-- ─── Badges cachés ───
  ('nuit_blanche',  'Nuit Blanche',  'Être actif entre minuit et 4h du matin',    '◑', 'prestige',    true),
  ('marathon',      'Marathon',      'Effectuer 5 actions dans la même journée',   '↻', 'progression', true),
  ('inspirateur',   'Inspirateur',   'Avoir un post qui reçoit 100 réactions',     '✧', 'prestige',    true),
  ('echo_parfait',  'Écho Parfait',  'Avoir un post qui reçoit 5 réponses',        '⊕', 'prestige',    true),
  ('verbe_rare',    'Verbe Rare',    'Écrire un contenu de plus de 300 caractères','∞', 'publication', true),
  ('fantome',       'Fantôme',       'Revenir après 14 jours d\'absence',          '◌', 'progression', true)

on conflict (id) do nothing;
