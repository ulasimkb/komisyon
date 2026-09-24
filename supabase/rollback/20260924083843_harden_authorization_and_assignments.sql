-- Emergency rollback for the 20260924 authorization and task security migrations.
-- Run as the migration owner in a single transaction. No application rows are deleted.
begin;

drop function if exists public.create_task_v2(uuid,text,text,uuid,text,date,date,date,text,text,text,text,text);
drop function if exists public.list_assignable_profiles(text);

drop trigger if exists tasks_guard_update on public.tasks;
drop function if exists private.guard_task_update();

drop trigger if exists tasks_resolve_assignment_ids on public.tasks;
create or replace function public.resolve_task_assignment_ids()
returns trigger language plpgsql set search_path=public as $$
begin
  select id into new.responsible_unit_id from public.units where name = new.responsible_unit_name and active limit 1;
  select id into new.assigned_to from public.profiles where full_name = new.assigned_person_name and active limit 1;
  return new;
end $$;
create trigger tasks_resolve_assignment_ids
before insert or update of responsible_unit_name, assigned_person_name on public.tasks
for each row execute function public.resolve_task_assignment_ids();
revoke all on function public.resolve_task_assignment_ids() from public, anon, authenticated;

create or replace function public.create_task(
  p_decision_id uuid, p_title text, p_responsible_unit_name text,
  p_assigned_person_name text, p_status text, p_target_end_date date,
  p_actual_start_date date, p_actual_end_date date, p_waiting_reason text,
  p_next_action text, p_completion_description text, p_cancellation_reason text,
  p_priority text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_role public.app_role := public.current_app_role();
  v_unit_id uuid;
  v_task_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Görev kaydetmek için oturum açmalısınız.' using errcode = '42501';
  end if;
  if v_role not in ('admin'::public.app_role, 'coordinator'::public.app_role, 'staff'::public.app_role) then
    raise exception 'Bu işlem için görev oluşturma yetkiniz yok.' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'Görev başlığı zorunludur.' using errcode = '23514';
  end if;
  if nullif(btrim(p_responsible_unit_name), '') is null then
    raise exception 'Sorumlu müdürlük zorunludur.' using errcode = '23514';
  end if;
  select unit.id into v_unit_id from public.units unit
  where unit.name = btrim(p_responsible_unit_name) and unit.active limit 1;
  if v_role = 'staff'::public.app_role
     and (public.current_unit_id() is null or public.current_unit_id() is distinct from v_unit_id) then
    raise exception 'Yalnızca kendi müdürlüğünüz için görev oluşturabilirsiniz.' using errcode = '42501';
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
  ) returning id into v_task_id;
  return v_task_id;
end $$;

drop policy if exists tasks_scoped_update on public.tasks;
create policy tasks_scoped_update on public.tasks for update to authenticated
using (
  (select public.current_app_role()) in ('admin','coordinator','controller')
  or assigned_to = (select auth.uid()) or responsible_unit_id = (select public.current_unit_id())
)
with check (
  (select public.current_app_role()) in ('admin','coordinator','controller')
  or assigned_to = (select auth.uid()) or responsible_unit_id = (select public.current_unit_id())
);

drop policy if exists tasks_scoped_insert on public.tasks;
create policy tasks_scoped_insert on public.tasks for insert to authenticated
with check (
  (select public.current_app_role()) in ('admin','coordinator')
  or ((select public.current_app_role())='staff' and responsible_unit_id=(select public.current_unit_id()))
);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'units','profiles','meetings','decision_packages','decisions','decision_clauses',
    'locations','location_aliases','decision_locations','tasks','task_dependencies',
    'correspondence','documents','evidence','decision_relations','import_jobs','audit_log'
  ] loop
    execute format('drop policy if exists app_role_required on public.%I', table_name);
  end loop;
end $$;

create or replace function public.current_app_role()
returns public.app_role language sql stable set search_path = '' as $$
  select coalesce((auth.jwt()->'app_metadata'->>'role')::public.app_role, 'viewer'::public.app_role)
$$;

commit;
