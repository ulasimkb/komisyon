alter table public.decisions
  add column if not exists neighborhood_name text;

comment on column public.decisions.neighborhood_name is
  'Kararın ilgili olduğu Kütahya Merkez mahallesi.';
