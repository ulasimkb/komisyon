-- Retire the separate review stage. Enum labels remain for safe PostgreSQL
-- compatibility, while constraints and triggers prevent new use.
update public.tasks
set status = case
  when actual_end_date is not null and nullif(trim(completion_description), '') is not null
    then 'completed'::public.task_status
  else 'in_progress'::public.task_status
end
where status = 'waiting_review';

update public.decisions
set application_status = 'in_progress'
where application_status = 'awaiting_review';

alter table public.tasks drop constraint if exists tasks_no_waiting_review;
alter table public.tasks add constraint tasks_no_waiting_review check (status <> 'waiting_review');
alter table public.decisions drop constraint if exists decisions_no_awaiting_review;
alter table public.decisions add constraint decisions_no_awaiting_review check (application_status <> 'awaiting_review');

create or replace function private.enforce_decision_application_status()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  task_total integer;
  completed_total integer;
  active_total integer;
begin
  if new.result = 'rejected' then new.application_status := null; return new; end if;
  if new.scope in ('Bilgi amaçlı', 'Görev alanı dışında') then new.application_status := 'not_required'; return new; end if;
  if tg_op = 'INSERT' then new.application_status := 'not_started'; return new; end if;

  select count(*), count(*) filter (where status='completed'), count(*) filter (where status not in ('planned','cancelled'))
  into task_total, completed_total, active_total
  from public.tasks where decision_id=new.id and mandatory and status<>'cancelled';

  new.application_status := case
    when task_total=0 then 'not_started'::public.application_status
    when completed_total=task_total then 'completed'::public.application_status
    when completed_total>0 then 'partial'::public.application_status
    when active_total>0 then 'in_progress'::public.application_status
    else 'not_started'::public.application_status
  end;
  return new;
end $$;

create or replace function private.recalculate_decision_application_status(target_decision_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  target_result public.decision_result;
  target_scope text;
  task_total integer;
  completed_total integer;
  active_total integer;
begin
  select result,scope into target_result,target_scope from public.decisions where id=target_decision_id;
  if target_result is null then return; end if;
  if target_result='rejected' then update public.decisions set application_status=null,updated_at=now() where id=target_decision_id; return; end if;
  if target_scope in ('Bilgi amaçlı','Görev alanı dışında') then update public.decisions set application_status='not_required',updated_at=now() where id=target_decision_id; return; end if;

  select count(*), count(*) filter (where status='completed'), count(*) filter (where status not in ('planned','cancelled'))
  into task_total,completed_total,active_total
  from public.tasks where decision_id=target_decision_id and mandatory and status<>'cancelled';

  update public.decisions set application_status=case
    when task_total=0 then 'not_started'::public.application_status
    when completed_total=task_total then 'completed'::public.application_status
    when completed_total>0 then 'partial'::public.application_status
    when active_total>0 then 'in_progress'::public.application_status
    else 'not_started'::public.application_status
  end,updated_at=now() where id=target_decision_id;
end $$;

revoke all on function private.enforce_decision_application_status(), private.recalculate_decision_application_status(uuid) from public,anon,authenticated;

update public.decisions set application_status=application_status;
