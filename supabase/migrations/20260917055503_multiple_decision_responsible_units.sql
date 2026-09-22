alter table public.decisions
  add column if not exists responsible_unit_names text[] not null default '{}';

update public.decisions
set responsible_unit_names = array[responsible_unit_name]
where responsible_unit_name is not null
  and cardinality(responsible_unit_names) = 0;

comment on column public.decisions.responsible_unit_names is
  'Kararın uygulanmasından birlikte sorumlu olan müdürlük adları.';
