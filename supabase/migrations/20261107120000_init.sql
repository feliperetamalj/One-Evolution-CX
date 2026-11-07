-- ONE · Experiencia de clientes (ver docs/ADR-001-arquitectura.md)
-- Toda la app accede con la secret key desde el servidor. anon/authenticated no ven nada.

create table clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) > 0),
  email text unique check (email = lower(email) and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text,
  plan text check (plan in ('personal', 'duo', 'plan3', 'plan4', 'plan6', 'pase')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- El id serial es el número de ola que ve el CEO ("Ola 7").
create table waves (
  id serial primary key,
  opens_at timestamptz not null default now(),
  closes_at timestamptz not null,
  check (closes_at > opens_at)
);

-- El id (uuid aleatorio, 122 bits) es el token del link personal /s/<id>.
create table invitations (
  id uuid primary key default gen_random_uuid(),
  wave_id int not null references waves on delete cascade,
  client_id uuid not null references clients on delete cascade,
  plan text, -- copia del plan al invitar, para segmentar aunque el cliente cambie de plan
  sent_at timestamptz,
  reminded_at timestamptz,
  unique (wave_id, client_id)
);

create table responses (
  invitation_id uuid primary key references invitations on delete cascade,
  nps smallint not null check (nps between 0 and 10),
  comment text check (length(comment) <= 2000),
  contact_ok boolean not null default false,
  followed_up_at timestamptz,
  created_at timestamptz not null default now()
);

-- Sin fila = "no aplica".
create table csat_scores (
  invitation_id uuid not null references responses on delete cascade,
  item text not null check (item in ('maquinas', 'disponibilidad', 'banos', 'limpieza', 'ambiente', 'clima', 'agenda', 'coach')),
  score smallint not null check (score between 1 and 5),
  primary key (invitation_id, item)
);

create table admins (
  email text primary key check (email = lower(email))
);

alter table clients enable row level security;
alter table waves enable row level security;
alter table invitations enable row level security;
alter table responses enable row level security;
alter table csat_scores enable row level security;
alter table admins enable row level security;

-- Conteos por ola y plan; los indicadores (NPS, %) se calculan en lib/survey.ts.
create view wave_plan_stats with (security_invoker = true) as
select
  i.wave_id,
  i.plan,
  count(*)::int as invited,
  count(r.invitation_id)::int as responded,
  (count(*) filter (where r.nps >= 9))::int as promoters,
  (count(*) filter (where r.nps <= 6))::int as detractors
from invitations i
left join responses r on r.invitation_id = i.id
group by i.wave_id, i.plan;

create view csat_stats with (security_invoker = true) as
select
  i.wave_id,
  i.plan,
  c.item,
  count(*)::int as n,
  (count(*) filter (where c.score >= 4))::int as top2,
  sum(c.score)::int as score_sum
from csat_scores c
join invitations i on i.id = c.invitation_id
group by i.wave_id, i.plan, c.item;

-- Abre una ola e invita a todos los clientes activos. Devuelve el número de ola.
create function open_wave(days_open int default 7) returns int
language plpgsql as $$
declare
  new_id int;
begin
  insert into waves (closes_at) values (now() + make_interval(days => days_open))
  returning id into new_id;
  insert into invitations (wave_id, client_id, plan)
  select new_id, id, plan from clients where active;
  return new_id;
end $$;

-- Guarda la respuesta completa (se llama tras el NPS y al enviar). Reemplaza lo anterior.
create function save_response(
  p_invitation uuid,
  p_nps int,
  p_csat jsonb default '{}',
  p_comment text default null,
  p_contact_ok boolean default false
) returns void
language plpgsql as $$
begin
  if not exists (
    select 1 from invitations i join waves w on w.id = i.wave_id
    where i.id = p_invitation and now() < w.closes_at
  ) then
    raise exception 'invitation_closed';
  end if;

  insert into responses (invitation_id, nps, comment, contact_ok)
  values (p_invitation, p_nps, nullif(trim(p_comment), ''), coalesce(p_contact_ok, false))
  on conflict (invitation_id) do update
    set nps = excluded.nps, comment = excluded.comment, contact_ok = excluded.contact_ok;

  delete from csat_scores where invitation_id = p_invitation;
  insert into csat_scores (invitation_id, item, score)
  select p_invitation, key, value::smallint from jsonb_each_text(coalesce(p_csat, '{}'));
end $$;

-- Supabase da acceso por defecto a anon/authenticated: se quita todo.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on function open_wave, save_response from public, anon, authenticated;
grant execute on function open_wave, save_response to service_role;
