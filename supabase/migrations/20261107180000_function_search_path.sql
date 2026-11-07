-- Advisor de Supabase (0011): fijar search_path para que nadie pueda redirigir las tablas que usan las funciones.
alter function open_wave(int) set search_path = pg_catalog, public;
alter function save_response(uuid, int, jsonb, text, boolean) set search_path = pg_catalog, public;
