-- Clientes que llegan con la ola ya abierta: se suman a esa ola con su enlace y sus preguntas.
-- Idempotente: quien ya está invitado no se toca.
create function invite_to_wave(p_wave int) returns int
language plpgsql set search_path = pg_catalog, public as $$
declare
  added int;
begin
  insert into invitations (wave_id, client_id, plan)
  select p_wave, id, plan from clients where active
  on conflict (wave_id, client_id) do nothing;
  get diagnostics added = row_count;
  perform assign_questions(p_wave);
  return added;
end $$;

revoke execute on function invite_to_wave from public, anon, authenticated;
grant execute on function invite_to_wave to service_role;
