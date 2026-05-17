-- Met à jour le trigger pour aussi ajouter le membre à son espace lors de l'inscription

create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_space_id uuid;
begin
  -- Créer le profil
  insert into public.profiles (id, pseudo)
  values (new.id, new.raw_user_meta_data->>'pseudo');

  -- Ajouter à l'espace si un space_id est fourni
  v_space_id := (new.raw_user_meta_data->>'space_id')::uuid;
  if v_space_id is not null then
    insert into public.space_members (space_id, user_id)
    values (v_space_id, new.id);
  end if;

  return new;
end;
$$ language plpgsql security definer;
