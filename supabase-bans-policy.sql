create policy if not exists "Voir son propre ban" on public.bans
  for select to authenticated using (user_id = auth.uid());
