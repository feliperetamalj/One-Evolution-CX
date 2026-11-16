-- Planes reales de ONE que faltaban: Libre y Universitario.
alter table clients drop constraint clients_plan_check;
alter table clients add constraint clients_plan_check
  check (plan in ('personal', 'duo', 'plan3', 'plan4', 'plan6', 'pase', 'libre', 'universitario'));
