create schema if not exists private;
revoke all on schema private from public, anon;

create or replace function private.recalculate_decision_application_status(target_decision_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_result public.decision_result;
  task_total integer;
  completed_total integer;
  review_total integer;
  active_total integer;
begin
  select result into target_result
  from public.decisions
  where id = target_decision_id;

  if target_result is null then
    return;
  end if;

  if target_result = 'rejected' then
    update public.decisions
    set application_status = null, updated_at = now()
    where id = target_decision_id;
    return;
  end if;

  select
    count(*),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'waiting_review'),
    count(*) filter (where status not in ('planned', 'cancelled'))
  into task_total, completed_total, review_total, active_total
  from public.tasks
  where decision_id = target_decision_id
    and mandatory = true
    and status <> 'cancelled';

  update public.decisions
  set application_status = case
      when task_total = 0 then 'not_started'::public.application_status
      when completed_total = task_total then 'completed'::public.application_status
      when review_total > 0 and completed_total + review_total = task_total then 'awaiting_review'::public.application_status
      when completed_total > 0 then 'partial'::public.application_status
      when active_total > 0 then 'in_progress'::public.application_status
      else 'not_started'::public.application_status
    end,
    updated_at = now()
  where id = target_decision_id;
end;
$$;

revoke all on function private.recalculate_decision_application_status(uuid)
from public, anon, authenticated;

create or replace function private.sync_decision_application_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.recalculate_decision_application_status(old.decision_id);
    return old;
  end if;

  perform private.recalculate_decision_application_status(new.decision_id);

  if tg_op = 'UPDATE' and old.decision_id <> new.decision_id then
    perform private.recalculate_decision_application_status(old.decision_id);
  end if;

  return new;
end;
$$;

revoke all on function private.sync_decision_application_status()
from public, anon, authenticated;

drop trigger if exists tasks_sync_decision_application_status on public.tasks;
create trigger tasks_sync_decision_application_status
after insert or update or delete on public.tasks
for each row execute function private.sync_decision_application_status();
