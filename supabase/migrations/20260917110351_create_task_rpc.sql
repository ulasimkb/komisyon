create or replace function public.create_task(
  p_decision_id uuid,
  p_title text,
  p_responsible_unit_name text,
  p_assigned_person_name text,
  p_status text,
  p_target_end_date date,
  p_actual_start_date date,
  p_actual_end_date date,
  p_waiting_reason text,
  p_next_action text,
  p_completion_description text,
  p_cancellation_reason text,
  p_priority text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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

  select unit.id
    into v_unit_id
    from public.units unit
   where unit.name = btrim(p_responsible_unit_name)
     and unit.active
   limit 1;

  if v_role = 'staff'::public.app_role
     and (public.current_unit_id() is null or public.current_unit_id() is distinct from v_unit_id) then
    raise exception 'Yalnızca kendi müdürlüğünüz için görev oluşturabilirsiniz.' using errcode = '42501';
  end if;

  insert into public.tasks (
    decision_id,
    title,
    responsible_unit_name,
    assigned_person_name,
    status,
    target_end_date,
    actual_start_date,
    actual_end_date,
    waiting_reason,
    next_action,
    completion_description,
    cancellation_reason,
    priority
  ) values (
    p_decision_id,
    btrim(p_title),
    btrim(p_responsible_unit_name),
    nullif(btrim(p_assigned_person_name), ''),
    p_status::public.task_status,
    p_target_end_date,
    p_actual_start_date,
    p_actual_end_date,
    nullif(btrim(p_waiting_reason), ''),
    nullif(btrim(p_next_action), ''),
    nullif(btrim(p_completion_description), ''),
    nullif(btrim(p_cancellation_reason), ''),
    p_priority
  )
  returning id into v_task_id;

  return v_task_id;
end;
$$;

revoke all on function public.create_task(uuid, text, text, text, text, date, date, date, text, text, text, text, text) from public;
grant execute on function public.create_task(uuid, text, text, text, text, date, date, date, text, text, text, text, text) to authenticated;
