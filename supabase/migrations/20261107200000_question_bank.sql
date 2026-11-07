-- Banco de preguntas CSAT (ver docs/ADR-001-arquitectura.md).
-- 8 categorías fijas, cada una con 5 a 7 preguntas activas. Cada invitación pregunta exactamente
-- 1 por categoría, elegida al abrir la ola. csat_scores.item pasa a ser la clave de la categoría.

create table csat_categories (
  key text primary key,
  label text not null,
  position smallint not null unique
);

-- "Quitar" una pregunta la archiva (active = false): sus respuestas pasadas siguen contando.
-- El texto no se edita, para no cambiarle el sentido a las respuestas que ya tiene.
create table questions (
  id serial primary key,
  category text not null references csat_categories,
  text text not null check (length(trim(text)) between 5 and 160),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Qué pregunta de cada categoría le tocó a cada invitación.
create table invitation_questions (
  invitation_id uuid not null references invitations on delete cascade,
  category text not null references csat_categories,
  question_id int not null references questions,
  primary key (invitation_id, category)
);

insert into csat_categories (key, label, position) values
  ('equipamiento', 'Equipamiento', 1),
  ('limpieza', 'Limpieza', 2),
  ('banos', 'Baños y camarines', 3),
  ('ambiente', 'Ambiente', 4),
  ('coach', 'Coach', 5),
  ('entrenamiento', 'Entrenamiento', 6),
  ('agenda', 'Agenda y horarios', 7),
  ('atencion', 'Atención', 8);

-- Cada texto completa la frase "¿Qué tan satisfecho/a estás con…?".
insert into questions (category, text)
select category, unnest(texts) from (values
  ('equipamiento', array[
    'El estado y la mantención de las máquinas',
    'La disponibilidad de máquinas y pesos durante tu sesión',
    'La variedad de equipamiento para tu entrenamiento',
    'El orden de pesas, discos y accesorios',
    'La rapidez con que se reparan los equipos con falla',
    'La calidad de las máquinas de cardio']),
  ('limpieza', array[
    'La limpieza de la sala de entrenamiento',
    'La limpieza de máquinas, bancas y colchonetas',
    'La disponibilidad de toallas y desinfectante',
    'El orden general del gimnasio',
    'La limpieza de la entrada y las zonas comunes',
    'La sensación de higiene al entrenar']),
  ('banos', array[
    'La limpieza de los baños y camarines',
    'El funcionamiento de las duchas',
    'La disponibilidad de lockers',
    'La reposición de papel, jabón y otros insumos',
    'El espacio y la comodidad de los camarines',
    'La privacidad en los camarines']),
  ('ambiente', array[
    'El volumen y la selección de la música',
    'El nivel de ruido durante tu sesión',
    'La temperatura de la sala',
    'La ventilación y la calidad del aire',
    'La iluminación del gimnasio',
    'La cantidad de personas entrenando al mismo tiempo']),
  ('coach', array[
    'La atención personalizada de tu coach',
    'Las correcciones de técnica que recibes',
    'La motivación que te transmite tu coach',
    'La preparación y el conocimiento de tu coach',
    'La puntualidad y la disposición de tu coach',
    'El seguimiento que hace de tus objetivos']),
  ('entrenamiento', array[
    'La planificación de tus entrenamientos',
    'La variedad de los ejercicios',
    'La intensidad de las sesiones según tu nivel',
    'El avance que sientes hacia tus objetivos',
    'La duración de las sesiones',
    'La dinámica de las clases grupales']),
  ('agenda', array[
    'La facilidad para agendar tus sesiones',
    'La disponibilidad de horarios que te acomodan',
    'La puntualidad con que empiezan las sesiones',
    'La facilidad para reagendar o cancelar',
    'Los recordatorios de tus sesiones',
    'Los horarios de apertura del gimnasio']),
  ('atencion', array[
    'La amabilidad del equipo de ONE',
    'La rapidez con que responden tus consultas',
    'La claridad de la información sobre planes y pagos',
    'La comunicación de cambios y novedades',
    'La bienvenida al llegar al gimnasio',
    'La forma en que resuelven tus problemas o reclamos'])
) v(category, texts);

-- 1 pregunta activa por categoría para cada invitación de la ola: al azar, pero sin repetir
-- la que ese cliente tuvo en la categoría en su invitación anterior.
create function assign_questions(p_wave int) returns void
language sql set search_path = pg_catalog, public as $$
  insert into invitation_questions (invitation_id, category, question_id)
  select distinct on (i.id, q.category) i.id, q.category, q.id
  from invitations i
  join questions q on q.active
  left join lateral (
    select iq.question_id
    from invitation_questions iq
    join invitations prev on prev.id = iq.invitation_id
    where prev.client_id = i.client_id and prev.wave_id < i.wave_id and iq.category = q.category
    order by prev.wave_id desc
    limit 1
  ) last on true
  where i.wave_id = p_wave
  order by i.id, q.category, q.id is not distinct from last.question_id, random()
  on conflict do nothing;
$$;

create or replace function open_wave(days_open int default 7) returns int
language plpgsql set search_path = pg_catalog, public as $$
declare
  new_id int;
begin
  insert into waves (closes_at) values (now() + make_interval(days => days_open))
  returning id into new_id;
  insert into invitations (wave_id, client_id, plan)
  select new_id, id, plan from clients where active;
  perform assign_questions(new_id);
  return new_id;
end $$;

-- Olas que ya existían: se les asignan preguntas y las notas pasan a categorías.
do $$
declare
  w int;
begin
  for w in select id from waves order by id loop
    perform assign_questions(w);
  end loop;
end $$;

alter table csat_scores drop constraint csat_scores_item_check;
update csat_scores set item = 'equipamiento' where item = 'maquinas';
delete from csat_scores where item not in (select key from csat_categories); -- disponibilidad y clima no tienen equivalente
-- Solo se puede guardar nota de una categoría que se le preguntó a esa invitación.
alter table csat_scores add foreign key (invitation_id, item)
  references invitation_questions (invitation_id, category) on delete cascade;

-- Notas por pregunta (todas las olas), para el banco de preguntas.
create view question_stats with (security_invoker = true) as
select
  iq.question_id,
  count(*)::int as n,
  (count(*) filter (where c.score >= 4))::int as top2
from invitation_questions iq
join csat_scores c on c.invitation_id = iq.invitation_id and c.item = iq.category
group by iq.question_id;

alter table csat_categories enable row level security;
alter table questions enable row level security;
alter table invitation_questions enable row level security;

revoke all on csat_categories, questions, invitation_questions, question_stats from anon, authenticated;
revoke all on sequence questions_id_seq from anon, authenticated;
revoke execute on function assign_questions from public, anon, authenticated;
grant execute on function assign_questions to service_role;
