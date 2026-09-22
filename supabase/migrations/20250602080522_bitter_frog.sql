-- Historical migration already present in the linked Supabase project.
alter table public.commissions
  add column departments text[] not null default '{}',
  add column notification_sent boolean not null default false;

create type public.department as enum (
  'Ulaşım Hizmetleri Müdürlüğü',
  'Fen İşleri Müdürlüğü',
  'Zabıta Müdürlüğü',
  'Basın Yayın Müdürlüğü',
  'Park ve Bahçeler Müdürlüğü',
  'Muhtarlık'
);

alter table public.commissions
  add constraint valid_departments check (
    departments <@ array[
      'Ulaşım Hizmetleri Müdürlüğü',
      'Fen İşleri Müdürlüğü',
      'Zabıta Müdürlüğü',
      'Basın Yayın Müdürlüğü',
      'Park ve Bahçeler Müdürlüğü',
      'Muhtarlık'
    ]::text[]
  );
