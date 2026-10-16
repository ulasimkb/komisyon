-- Üst karar numarası yalnızca yıl/sıra biçiminde olabilir (örnek: 2026/01).
-- Uygulamadaki packageNoPattern ile aynı kuraldır; mevcut kayıtların tamamı bu biçimdedir.
alter table public.decisions
  add constraint decisions_package_no_format
  check (package_no ~ '^20[0-9]{2}/[0-9]{2}$');
