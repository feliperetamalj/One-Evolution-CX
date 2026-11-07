-- Datos ficticios para desarrollar el dashboard. NUNCA en una base con clientes reales.
-- 40 clientes y 12 olas cada 14 días (la 12 sigue abierta). En la ola 9 caen "Baños" y el NPS.
-- Un solo bloque DO para poder correrlo también con `supabase db query --remote`.

do $seed$
declare
  w int;
begin
  perform setseed(0.42);

  insert into clients (full_name, email, plan)
  select
    (array['Camila', 'Matías', 'Valentina', 'Benjamín', 'Antonia', 'Vicente', 'Josefa', 'Tomás', 'Isidora', 'Joaquín'])[1 + g % 10]
      || ' ' || (array['Muñoz', 'Rojas', 'Díaz', 'Soto', 'Contreras', 'Silva', 'Morales', 'Sepúlveda'])[1 + g % 8],
    'cliente' || g || '@example.com',
    (array['personal', 'duo', 'plan3', 'plan4', 'plan6'])[1 + g % 5]
  from generate_series(1, 40) g;

  insert into waves (id, opens_at, closes_at)
  select g, now() - make_interval(days => 14 * (12 - g) + 2), now() - make_interval(days => 14 * (12 - g) + 2) + interval '7 days'
  from generate_series(1, 12) g;
  perform setval('waves_id_seq', 12);

  insert into invitations (wave_id, client_id, plan, sent_at)
  select wv.id, c.id, c.plan, wv.opens_at from waves wv cross join clients c;

  for w in 1..12 loop
    perform assign_questions(w);
  end loop;

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
    select i.id, wv.opens_at,
      least(10, greatest(0, floor(6 + random() * 5.5
        + (array[0.2, 0.4, 0.3, 0.5, 0.1, -0.2, 0.0, 0.3, -0.9, -0.3, 0.2, 0.4])[wv.id])))::int as nps
    from invitations i join waves wv on wv.id = i.wave_id
    -- referencia a i (no a wv) para que el filtro se evalúe por invitación y no por ola
    where random() < case when i.wave_id = 12 then 0.45 else 0.72 end
  ) r;

  insert into csat_scores (invitation_id, item, score)
  select r.invitation_id, iq.category,
    least(5, greatest(1, round(3.4 + random() * 2
      + (array[0.2, 0.1, 0.0, -0.3, 0.5, 0.3, 0.1, 0.2])[cat.position]
      + (abs(hashtext(q.text)) % 7 - 3) * 0.12 -- cada pregunta tiene su propio nivel
      + case when iq.category = 'banos' and i.wave_id = 9 then -1.4 else 0 end)))::int
  from responses r
  join invitations i on i.id = r.invitation_id
  join invitation_questions iq on iq.invitation_id = r.invitation_id
  join questions q on q.id = iq.question_id
  join csat_categories cat on cat.key = iq.category
  where abs(hashtext(r.invitation_id::text || iq.category)) % 100 < 92; -- ~8 % "no aplica"

  -- Seguimiento hecho a los detractores hasta la ola 9; los de las olas 10 a 12 quedan pendientes.
  update responses r set followed_up_at = r.created_at + interval '1 day'
  from invitations i
  where i.id = r.invitation_id and r.nps <= 6 and r.contact_ok and i.wave_id <= 9;
end $seed$;
