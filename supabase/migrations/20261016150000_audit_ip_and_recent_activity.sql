-- Değişiklik kaydına işlemi yapanın IP adresini ekler ve Ayarlar sayfasındaki
-- "Son hareketler" kartı için okunabilir bir liste fonksiyonu tanımlar.
-- Mevcut kayıtlar değiştirilmez; IP yalnızca bu andan sonraki işlemlerde tutulur.
alter table public.audit_log add column ip_address text;

-- PostgREST her isteğin başlıklarını request.headers ayarında verir. Supabase'in önündeki
-- vekil sunucu istemci IP'sini x-forwarded-for başlığının ilk değeri olarak iletir.
create or replace function public.request_ip_address()
returns text language plpgsql stable set search_path = '' as $$
declare headers jsonb;
begin
  headers := nullif(current_setting('request.headers', true), '')::jsonb;
  return nullif(btrim(coalesce(
    split_part(headers->>'x-forwarded-for', ',', 1),
    headers->>'cf-connecting-ip',
    headers->>'x-real-ip'
  )), '');
exception when others then
  return null;
end $$;
revoke all on function public.request_ip_address() from public, anon, authenticated;

create or replace function public.audit_changes()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_catalog' as $function$
begin
  insert into public.audit_log(table_name, record_id, operation, old_values, new_values, changed_by, ip_address)
  values (
    tg_table_name, coalesce(new.id, old.id)::text, tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end,
    auth.uid(), public.request_ip_address()
  );
  return coalesce(new, old);
end $function$;

-- Son hareketler: audit_log okuma politikasıyla aynı roller (yönetici, koordinatör, kontrol).
create function public.recent_audit_activity(p_limit integer default 5)
returns table (
  changed_at timestamptz, table_name text, operation text, record_label text,
  user_email text, ip_address text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.current_app_role() is null
     or public.current_app_role() not in ('admin', 'coordinator', 'controller') then
    raise exception 'İşlem geçmişini görme yetkiniz yok.' using errcode = '42501';
  end if;
  return query
  select
    log.changed_at, log.table_name, log.operation,
    case log.table_name
      when 'decisions' then concat_ws(' — ',
        nullif(concat_ws(' / ', coalesce(log.new_values, log.old_values)->>'package_no', coalesce(log.new_values, log.old_values)->>'item_no'), ''),
        coalesce(log.new_values, log.old_values)->>'title')
      when 'tasks' then coalesce(log.new_values, log.old_values)->>'title'
      when 'correspondence' then concat_ws(' — ',
        coalesce(log.new_values, log.old_values)->>'document_no',
        coalesce(log.new_values, log.old_values)->>'subject')
      else log.record_id
    end,
    account.email::text,
    log.ip_address
  from public.audit_log log
  left join auth.users account on account.id = log.changed_by
  order by log.changed_at desc, log.id desc
  limit least(greatest(coalesce(p_limit, 5), 1), 50);
end $$;
revoke all on function public.recent_audit_activity(integer) from public, anon;
grant execute on function public.recent_audit_activity(integer) to authenticated;
