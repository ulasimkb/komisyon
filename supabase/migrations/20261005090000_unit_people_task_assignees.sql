-- Müdürlük personeli: oturum hesabı olmadan görevlere sorumlu olarak atanabilen kişiler.
-- Hesap tabanlı tasks.assigned_to ve ona bağlı yetkilendirme değişmez; bu kişiler
-- yalnızca sorumluluk bilgisini taşır, hiçbir kayda erişim yetkisi vermez.
create table public.unit_people (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  full_name text not null check (nullif(btrim(full_name), '') is not null),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (unit_id, full_name)
);

create table public.task_people (
  task_id uuid not null references public.tasks(id) on delete cascade,
  person_id uuid not null references public.unit_people(id),
  created_at timestamptz not null default now(),
  primary key (task_id, person_id)
);
create index task_people_person_id_idx on public.task_people(person_id);

-- Kişi listesi task_people üzerinden yönetilen görevler. Bu görevlerde hesapsız
-- eski tasks.assigned_person_name metni artık sorumlu kişi olarak gösterilmez.
create table public.task_people_managed (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.unit_people enable row level security;
alter table public.task_people enable row level security;
alter table public.task_people_managed enable row level security;
create policy app_role_required on public.task_people_managed as restrictive for all to authenticated
using ((select public.current_app_role()) is not null)
with check ((select public.current_app_role()) is not null);
create policy task_people_managed_read on public.task_people_managed for select to authenticated
using (exists (select 1 from public.tasks task where task.id = task_id));
revoke all on public.task_people_managed from anon;
grant select on public.task_people_managed to authenticated;

create policy app_role_required on public.unit_people as restrictive for all to authenticated
using ((select public.current_app_role()) is not null)
with check ((select public.current_app_role()) is not null);
create policy app_role_required on public.task_people as restrictive for all to authenticated
using ((select public.current_app_role()) is not null)
with check ((select public.current_app_role()) is not null);

create policy unit_people_read on public.unit_people for select to authenticated using (true);
create policy unit_people_admin_write on public.unit_people for all to authenticated
using ((select public.current_app_role()) = 'admin')
with check ((select public.current_app_role()) = 'admin');

-- Görev satırı görülebiliyorsa (tasks RLS) atanan kişileri de görülebilir.
-- Yazma yalnızca aşağıdaki security definer fonksiyonlar üzerinden yapılır.
create policy task_people_read on public.task_people for select to authenticated
using (exists (select 1 from public.tasks task where task.id = task_id));

revoke all on public.unit_people, public.task_people from anon;
grant select on public.task_people to authenticated;
grant select, insert, update, delete on public.unit_people to authenticated;

-- Kişileri doğrular ve görevin kişi listesini verilen liste ile değiştirir.
create function private.replace_task_people(p_task_id uuid, p_person_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare target_unit_id uuid;
declare requested uuid[] := coalesce((select array_agg(distinct requested_id) from unnest(p_person_ids) as r(requested_id) where requested_id is not null), '{}');
begin
  select task.responsible_unit_id into target_unit_id from public.tasks task where task.id = p_task_id;
  if not found then
    raise exception 'Görev bulunamadı.' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from unnest(requested) as r(requested_id)
    where not exists (
      select 1 from public.unit_people person
      where person.id = r.requested_id and person.active and person.unit_id = target_unit_id
    )
  ) then
    raise exception 'Seçilen kişilerden biri bu müdürlükte aktif değil.' using errcode = '23514';
  end if;
  delete from public.task_people link where link.task_id = p_task_id and link.person_id <> all (requested);
  insert into public.task_people (task_id, person_id)
  select p_task_id, r.requested_id from unnest(requested) as r(requested_id)
  on conflict do nothing;
  insert into public.task_people_managed (task_id) values (p_task_id)
  on conflict do nothing;
end $$;
revoke all on function private.replace_task_people(uuid, uuid[]) from public, anon, authenticated;

create function public.set_task_people(p_task_id uuid, p_person_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.current_app_role() is null
     or public.current_app_role() not in ('admin','coordinator') then
    raise exception 'Görevin sorumlu kişilerini değiştirme yetkiniz yok.' using errcode = '42501';
  end if;
  perform private.replace_task_people(p_task_id, p_person_ids);
end $$;
revoke all on function public.set_task_people(uuid, uuid[]) from public, anon;
grant execute on function public.set_task_people(uuid, uuid[]) to authenticated;

-- create_task_v2 ile aynı yetki kontrolleri; görev ve kişileri tek işlemde kaydeder.
create function public.create_task_v3(
  p_decision_id uuid, p_title text, p_responsible_unit_name text,
  p_assigned_to uuid, p_person_ids uuid[], p_status text, p_target_end_date date,
  p_actual_start_date date, p_actual_end_date date, p_waiting_reason text,
  p_next_action text, p_completion_description text, p_cancellation_reason text,
  p_priority text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare task_id uuid;
begin
  task_id := public.create_task_v2(
    p_decision_id, p_title, p_responsible_unit_name, p_assigned_to, p_status,
    p_target_end_date, p_actual_start_date, p_actual_end_date, p_waiting_reason,
    p_next_action, p_completion_description, p_cancellation_reason, p_priority
  );
  perform private.replace_task_people(task_id, p_person_ids);
  return task_id;
end $$;
revoke all on function public.create_task_v3(uuid,text,text,uuid,uuid[],text,date,date,date,text,text,text,text,text) from public, anon;
grant execute on function public.create_task_v3(uuid,text,text,uuid,uuid[],text,date,date,date,text,text,text,text,text) to authenticated;

-- Görevin müdürlüğü değişirse eski müdürlüğün kişileri görevden düşer.
create function private.drop_foreign_task_people()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.task_people link
  using public.unit_people person
  where link.task_id = new.id and person.id = link.person_id
    and person.unit_id is distinct from new.responsible_unit_id;
  return null;
end $$;
revoke all on function private.drop_foreign_task_people() from public, anon, authenticated;
create trigger tasks_drop_foreign_task_people
after update of responsible_unit_id on public.tasks
for each row when (new.responsible_unit_id is distinct from old.responsible_unit_id)
execute function private.drop_foreign_task_people();

-- Ulaşım Hizmetleri Müdürlüğü personeli.
insert into public.unit_people (unit_id, full_name)
select unit.id, person.full_name
from public.units unit
cross join (values ('Fatma Nur YILDIRIM'), ('Azime ATAGÜN'), ('Hasan COŞKUN')) as person(full_name)
where unit.name = 'Ulaşım Hizmetleri Müdürlüğü';

-- Hesapsız eski serbest metin atamalarını eşleşen personel kaydına bağla.
-- tasks satırları değiştirilmez; eski ad tarihsel kayıt olarak yerinde kalır ve
-- task_people_managed işareti olan görevlerde arayüzde gösterilmez.
insert into public.task_people (task_id, person_id)
select task.id, person.id
from public.tasks task
join public.unit_people person
  on person.unit_id = task.responsible_unit_id and person.full_name = task.assigned_person_name
where task.assigned_to is null;

insert into public.task_people_managed (task_id)
select distinct link.task_id from public.task_people link;
