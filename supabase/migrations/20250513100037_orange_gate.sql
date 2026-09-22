-- Historical migration already present in the linked Supabase project.
create table if not exists public.commissions (
  id serial primary key,
  created_at timestamptz default now(),
  commission_date date not null,
  commission_decision text not null,
  neighborhood text not null,
  street text not null,
  commission_subject text not null
);

alter table public.commissions enable row level security;

create policy "Anyone can read commissions"
  on public.commissions
  for select
  to anon
  using (true);

create policy "Anyone can insert commissions"
  on public.commissions
  for insert
  to anon
  with check (true);

-- The legacy table is retained for migration-history parity only; the current
-- application does not expose or use it.
revoke all on public.commissions from anon, authenticated;
