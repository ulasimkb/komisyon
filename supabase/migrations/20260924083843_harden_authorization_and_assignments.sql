-- Fail closed for accounts without an explicitly assigned application role.
-- This migration changes no existing decision, task, or correspondence rows.
do $$
begin
  if exists (
    select 1 from auth.users
    where raw_app_meta_data->>'role' is null
       or raw_app_meta_data->>'role' not in ('admin','coordinator','staff','controller','viewer')
  ) then
    raise exception 'Assign valid app_metadata.role values to existing users before applying this migration.';
  end if;
end $$;

create or replace function public.current_app_role()
returns public.app_role language sql stable set search_path = '' as $$
  select nullif(auth.jwt()->'app_metadata'->>'role','')::public.app_role
$$;

-- Several reference-table policies formerly allowed every authenticated user.
-- A restrictive policy ensures that none of those paths admits an unassigned user.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'units','profiles','meetings','decision_packages','decisions','decision_clauses',
    'locations','location_aliases','decision_locations','tasks','task_dependencies',
    'correspondence','documents','evidence','decision_relations','import_jobs','audit_log'
  ] loop
    execute format(
      'create policy app_role_required on public.%I as restrictive for all to authenticated using ((select public.current_app_role()) is not null) with check ((select public.current_app_role()) is not null)',
      table_name
    );
  end loop;
end $$;

-- Reviewers may review evidence, but may not edit implementation tasks.
drop policy tasks_scoped_update on public.tasks;
create policy tasks_scoped_update on public.tasks for update to authenticated
using (
  (select public.current_app_role()) in ('admin','coordinator')
  or ((select public.current_app_role()) = 'staff'
      and (assigned_to = (select auth.uid()) or responsible_unit_id = (select public.current_unit_id())))
)
with check (
  (select public.current_app_role()) in ('admin','coordinator')
  or ((select public.current_app_role()) = 'staff'
      and (assigned_to = (select auth.uid()) or responsible_unit_id = (select public.current_unit_id())))
);

create or replace function private.guard_task_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare actor_role public.app_role := public.current_app_role();
begin
  if actor_role is null or actor_role not in ('admin','coordinator','staff') then
    raise exception 'Görev güncelleme yetkiniz yok.' using errcode = '42501';
  end if;

  if new.id is distinct from old.id
     or new.decision_id is distinct from old.decision_id
     or new.clause_id is distinct from old.clause_id
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.mandatory is distinct from old.mandatory
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.responsible_unit_id is distinct from old.responsible_unit_id then
    raise exception 'Görevin temel bağlantıları ve zorunluluk bilgisi değiştirilemez.' using errcode = '42501';
  end if;

  if actor_role = 'staff' and (
       new.responsible_unit_name is distinct from old.responsible_unit_name
       or new.assigned_to is distinct from old.assigned_to
       or new.assigned_person_name is distinct from old.assigned_person_name
     ) then
    raise exception 'Personel görev müdürlüğünü veya atanan kişiyi değiştiremez.' using errcode = '42501';
  end if;

  if new.assigned_person_name is distinct from old.assigned_person_name
     and new.assigned_to is not distinct from old.assigned_to then
    raise exception 'Kişi adı doğrudan değiştirilemez; kullanıcı kimliğini seçin.' using errcode = '42501';
  end if;

  return new;
end $$;

revoke all on function private.guard_task_update() from public, anon, authenticated;
create trigger tasks_guard_update before update on public.tasks
for each row execute function private.guard_task_update();

-- The UUID is authoritative. Historical free-text names stay visible but no
-- longer grant access through an ambiguous full_name lookup.
create or replace function public.resolve_task_assignment_ids()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  select unit.id into new.responsible_unit_id
  from public.units unit where unit.name = new.responsible_unit_name and unit.active;

  if new.assigned_to is not null then
    select profile.full_name into new.assigned_person_name
    from public.profiles profile
    where profile.id = new.assigned_to and profile.active
      and profile.unit_id = new.responsible_unit_id;
    if new.assigned_person_name is null then
      raise exception 'Seçilen kullanıcı bu müdürlükte aktif değil.' using errcode = '23514';
    end if;
  elsif tg_op = 'UPDATE' and new.assigned_to is distinct from old.assigned_to then
    new.assigned_person_name := null;
  end if;
  return new;
end $$;

drop trigger tasks_resolve_assignment_ids on public.tasks;
create trigger tasks_resolve_assignment_ids
before insert or update of responsible_unit_name, assigned_to on public.tasks
for each row execute function public.resolve_task_assignment_ids();

-- List only real, active accounts. Staff may list their own unit only.
create function public.list_assignable_profiles(p_unit_name text)
returns table(id uuid, full_name text)
language plpgsql stable security definer set search_path = '' as $$
declare actor_role public.app_role := public.current_app_role();
declare target_unit_id uuid;
begin
  if auth.uid() is null or actor_role is null
     or actor_role not in ('admin','coordinator','staff') then
    raise exception 'Kullanıcı listesi yetkiniz yok.' using errcode = '42501';
  end if;
  select unit.id into target_unit_id from public.units unit
  where unit.name = p_unit_name and unit.active;
  if actor_role = 'staff' and target_unit_id is distinct from public.current_unit_id() then
    raise exception 'Yalnızca kendi müdürlüğünüzün kullanıcılarını görebilirsiniz.' using errcode = '42501';
  end if;
  return query select profile.id, profile.full_name from public.profiles profile
  where profile.active and profile.unit_id = target_unit_id
  order by profile.full_name, profile.id;
end $$;
revoke all on function public.list_assignable_profiles(text) from public, anon;
grant execute on function public.list_assignable_profiles(text) to authenticated;

-- Keep the original RPC for already deployed clients, but close its RLS bypass.
create or replace function public.create_task(
  p_decision_id uuid, p_title text, p_responsible_unit_name text,
  p_assigned_person_name text, p_status text, p_target_end_date date,
  p_actual_start_date date, p_actual_end_date date, p_waiting_reason text,
  p_next_action text, p_completion_description text, p_cancellation_reason text,
  p_priority text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_role public.app_role := public.current_app_role();
declare actor_unit_id uuid := public.current_unit_id();
declare target_unit_id uuid;
declare task_id uuid;
begin
  if auth.uid() is null or actor_role is null
     or actor_role not in ('admin','coordinator','staff') then
    raise exception 'Görev oluşturma yetkiniz yok.' using errcode = '42501';
  end if;
  if nullif(btrim(p_title),'') is null or nullif(btrim(p_responsible_unit_name),'') is null then
    raise exception 'Görev başlığı ve sorumlu müdürlük zorunludur.' using errcode = '23514';
  end if;
  select unit.id into target_unit_id from public.units unit
  where unit.name = btrim(p_responsible_unit_name) and unit.active;
  if target_unit_id is null then
    raise exception 'Aktif sorumlu müdürlük bulunamadı.' using errcode = '23514';
  end if;
  if actor_role = 'staff' then
    if actor_unit_id is null or actor_unit_id is distinct from target_unit_id then
      raise exception 'Yalnızca kendi müdürlüğünüz için görev oluşturabilirsiniz.' using errcode = '42501';
    end if;
    if p_status is distinct from 'planned' then
      raise exception 'Personel yeni görevi yalnızca Planlandı durumunda açabilir.' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.decisions decision
      where decision.id = p_decision_id
        and (decision.unit_scope_id = actor_unit_id or exists (
          select 1 from public.tasks task where task.decision_id = decision.id
            and (task.assigned_to = auth.uid() or task.responsible_unit_id = actor_unit_id)
        ))
    ) then
      raise exception 'Bu kararı görme yetkiniz yok.' using errcode = '42501';
    end if;
  end if;
  insert into public.tasks (
    decision_id,title,responsible_unit_name,assigned_person_name,status,
    target_end_date,actual_start_date,actual_end_date,waiting_reason,next_action,
    completion_description,cancellation_reason,priority
  ) values (
    p_decision_id,btrim(p_title),btrim(p_responsible_unit_name),
    nullif(btrim(p_assigned_person_name),''),p_status::public.task_status,
    p_target_end_date,p_actual_start_date,p_actual_end_date,
    nullif(btrim(p_waiting_reason),''),nullif(btrim(p_next_action),''),
    nullif(btrim(p_completion_description),''),nullif(btrim(p_cancellation_reason),''),p_priority
  ) returning id into task_id;
  return task_id;
end $$;

-- New clients pass an account UUID. The legacy text RPC above never resolves
-- its display name into an authorization-bearing assigned_to value.
create function public.create_task_v2(
  p_decision_id uuid, p_title text, p_responsible_unit_name text,
  p_assigned_to uuid, p_status text, p_target_end_date date,
  p_actual_start_date date, p_actual_end_date date, p_waiting_reason text,
  p_next_action text, p_completion_description text, p_cancellation_reason text,
  p_priority text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_role public.app_role := public.current_app_role();
declare actor_unit_id uuid := public.current_unit_id();
declare target_unit_id uuid;
declare task_id uuid;
begin
  if auth.uid() is null or actor_role is null
     or actor_role not in ('admin','coordinator','staff') then
    raise exception 'Görev oluşturma yetkiniz yok.' using errcode = '42501';
  end if;
  if nullif(btrim(p_title),'') is null or nullif(btrim(p_responsible_unit_name),'') is null then
    raise exception 'Görev başlığı ve sorumlu müdürlük zorunludur.' using errcode = '23514';
  end if;
  select unit.id into target_unit_id from public.units unit
  where unit.name = btrim(p_responsible_unit_name) and unit.active;
  if target_unit_id is null then
    raise exception 'Aktif sorumlu müdürlük bulunamadı.' using errcode = '23514';
  end if;
  if actor_role = 'staff' then
    if actor_unit_id is null or actor_unit_id is distinct from target_unit_id then
      raise exception 'Yalnızca kendi müdürlüğünüz için görev oluşturabilirsiniz.' using errcode = '42501';
    end if;
    if p_status is distinct from 'planned' then
      raise exception 'Personel yeni görevi yalnızca Planlandı durumunda açabilir.' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.decisions decision
      where decision.id = p_decision_id
        and (decision.unit_scope_id = actor_unit_id or exists (
          select 1 from public.tasks task where task.decision_id = decision.id
            and (task.assigned_to = auth.uid() or task.responsible_unit_id = actor_unit_id)
        ))
    ) then
      raise exception 'Bu kararı görme yetkiniz yok.' using errcode = '42501';
    end if;
  end if;
  insert into public.tasks (
    decision_id,title,responsible_unit_name,assigned_to,status,
    target_end_date,actual_start_date,actual_end_date,waiting_reason,next_action,
    completion_description,cancellation_reason,priority
  ) values (
    p_decision_id,btrim(p_title),btrim(p_responsible_unit_name),p_assigned_to,
    p_status::public.task_status,p_target_end_date,p_actual_start_date,p_actual_end_date,
    nullif(btrim(p_waiting_reason),''),nullif(btrim(p_next_action),''),
    nullif(btrim(p_completion_description),''),nullif(btrim(p_cancellation_reason),''),p_priority
  ) returning id into task_id;
  return task_id;
end $$;
revoke all on function public.create_task_v2(uuid,text,text,uuid,text,date,date,date,text,text,text,text,text) from public, anon;
grant execute on function public.create_task_v2(uuid,text,text,uuid,text,date,date,date,text,text,text,text,text) to authenticated;
