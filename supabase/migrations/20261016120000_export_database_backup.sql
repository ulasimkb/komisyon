-- Uygulamadaki "Veritabanını yedekle" düğmesi için: public şemasındaki tüm tabloların
-- verilerini tek bir anlık görüntü (tek sorgu, tek işlem) olarak JSON döndürür.
-- Yalnızca yönetici çalıştırabilir. Giriş hesapları (auth) dahil edilmez.
-- Sonradan eklenen tablolar otomatik olarak yedeğe girer.
create function public.export_database_backup()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  table_rows jsonb;
  tables jsonb := '{}'::jsonb;
  table_name text;
begin
  if auth.uid() is null or public.current_app_role() is distinct from 'admin'::public.app_role then
    raise exception 'Veritabanı yedeğini yalnızca yönetici alabilir.' using errcode = '42501';
  end if;

  for table_name in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(row_data)), ''[]''::jsonb) from public.%I row_data', table_name)
      into table_rows;
    tables := tables || jsonb_build_object(table_name, table_rows);
  end loop;

  return jsonb_build_object(
    'format', 'komisyon-veritabani-yedegi',
    'version', 1,
    'createdAt', now(),
    'tables', tables
  );
end $$;

revoke all on function public.export_database_backup() from public, anon;
grant execute on function public.export_database_backup() to authenticated;
