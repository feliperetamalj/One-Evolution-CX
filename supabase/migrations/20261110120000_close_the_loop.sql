-- Close the loop: seguimiento de casos (ver docs/ADR-001-arquitectura.md).
-- Un caso = respuesta con contact_ok que es detractor (0–6) o que el admin marcó (flagged).
-- Estado: pendiente (sin followed_up_at) → contactado → cerrado (closed_at).
alter table responses
  add column flagged boolean not null default false,
  add column followup_note text check (length(followup_note) <= 1000),
  add column closed_at timestamptz;
