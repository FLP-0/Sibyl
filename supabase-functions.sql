-- Fonction de vérification du code d'espace
-- Permet au client de vérifier un code sans exposer toute la table spaces

create or replace function public.get_space_by_code(input_code text)
returns table(id uuid, name text) as $$
  select id, name from public.spaces where code = input_code limit 1;
$$ language sql security definer stable;

grant execute on function public.get_space_by_code(text) to anon;
