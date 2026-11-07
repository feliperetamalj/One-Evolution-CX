-- Ajustes del panel, en una sola fila. Reemplaza la variable de entorno ALERT_EMAIL.
create table settings (
  id boolean primary key default true check (id),
  alert_emails text[] not null default '{}' -- quién recibe la alerta de detractores
);
insert into settings default values;

alter table settings enable row level security;
revoke all on settings from anon, authenticated;
