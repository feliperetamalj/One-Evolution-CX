-- Datos ficticios para desarrollar el dashboard. Solo en one-cx-dev, NUNCA en producción.
-- 40 clientes, 4 olas (la 4 sigue abierta). En la ola 3 cae "Baños" y baja el NPS.

select setseed(0.42);

insert into clients (full_name, email, plan)
select
  (array['Camila', 'Matías', 'Valentina', 'Benjamín', 'Antonia', 'Vicente', 'Josefa', 'Tomás', 'Isidora', 'Joaquín'])[1 + g % 10]
    || ' ' || (array['Muñoz', 'Rojas', 'Díaz', 'Soto', 'Contreras', 'Silva', 'Morales', 'Sepúlveda'])[1 + g % 8],
  'cliente' || g || '@example.com',
  (array['personal', 'duo', 'plan3', 'plan4', 'plan6'])[1 + g % 5]
from generate_series(1, 40) g;

insert into waves (id, opens_at, closes_at)
select w, now() - make_interval(days => 14 * (4 - w) + 2), now() - make_interval(days => 14 * (4 - w) + 2) + interval '7 days'
from generate_series(1, 4) w;
select setval('waves_id_seq', 4);

insert into invitations (wave_id, client_id, plan, sent_at)
select w.id, c.id, c.plan, w.opens_at from waves w cross join clients c;

insert into responses (invitation_id, nps, comment, contact_ok, created_at)
select
  id,
  nps,
  case when random() < 0.6 then
    case
      when nps >= 9 then (array['Los coaches son lo mejor, siempre atentos.', 'Me encanta que la sala nunca esté llena.', 'Se nota la planificación de cada sesión.', 'Excelente ambiente, muy cómodo para entrenar.'])[1 + floor(random() * 4)::int]
      when nps >= 7 then (array['A veces la música está muy fuerte.', 'Faltaría mejor ventilación en la tarde.', 'Me gustaría más flexibilidad para reagendar.', 'Todo bien, pero los camarines podrían estar mejor.'])[1 + floor(random() * 4)::int]
      else (array['Los baños estaban sucios dos veces esta semana.', 'Hace mucho calor en la sala en la tarde.', 'Mi clase empezó tarde varias veces.', 'Las duchas no tenían agua caliente.'])[1 + floor(random() * 4)::int]
    end
  end,
  random() < 0.5,
  opens_at + make_interval(hours => floor(random() * 72)::int)
from (
  select i.id, w.opens_at,
    least(10, greatest(0, floor(6 + random() * 5.5 + (array[0.3, 0.5, -0.9, 0.2])[w.id])))::int as nps
  from invitations i join waves w on w.id = i.wave_id
  -- referencia a i (no a w) para que el filtro se evalúe por invitación y no por ola
  where random() < case when i.wave_id = 4 then 0.45 else 0.72 end
) r;

insert into csat_scores (invitation_id, item, score)
select r.invitation_id, it.item,
  least(5, greatest(1, round(3.4 + random() * 2 + it.shift + case when it.item = 'banos' and i.wave_id = 3 then -1.4 else 0 end)))::int
from responses r
join invitations i on i.id = r.invitation_id
cross join (values ('maquinas', 0.2), ('disponibilidad', 0.0), ('banos', 0.0), ('limpieza', 0.1),
                   ('ambiente', -0.2), ('clima', -0.5), ('agenda', 0.1), ('coach', 0.5)) it(item, shift)
where abs(hashtext(r.invitation_id::text || it.item)) % 100 < 92; -- ~8 % "no aplica"

-- Seguimiento hecho a los detractores de olas cerradas, salvo la ola 3 (quedan pendientes).
update responses r set followed_up_at = r.created_at + interval '1 day'
from invitations i
where i.id = r.invitation_id and r.nps <= 6 and r.contact_ok and i.wave_id in (1, 2);
