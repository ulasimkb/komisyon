create or replace function private.enforce_decision_application_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_total integer;
  completed_total integer;
  review_total integer;
  active_total integer;
begin
  if new.result = 'rejected' then
    new.application_status := null;
    return new;
  end if;

  if new.scope in ('Bilgi amaçlı', 'Görev alanı dışında') then
    new.application_status := 'not_required'::public.application_status;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.application_status := 'not_started'::public.application_status;
    return new;
  end if;

  select
    count(*),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'waiting_review'),
    count(*) filter (where status not in ('planned', 'cancelled'))
  into task_total, completed_total, review_total, active_total
  from public.tasks
  where decision_id = new.id
    and mandatory = true
    and status <> 'cancelled';

  new.application_status := case
    when task_total = 0 then 'not_started'::public.application_status
    when completed_total = task_total then 'completed'::public.application_status
    when review_total > 0 and completed_total + review_total = task_total then 'awaiting_review'::public.application_status
    when completed_total > 0 then 'partial'::public.application_status
    when active_total > 0 then 'in_progress'::public.application_status
    else 'not_started'::public.application_status
  end;
  return new;
end;
$$;

revoke all on function private.enforce_decision_application_status()
from public, anon, authenticated;

drop trigger if exists decisions_enforce_application_status on public.decisions;
create trigger decisions_enforce_application_status
before insert or update of result, scope, application_status on public.decisions
for each row execute function private.enforce_decision_application_status();

create or replace function private.recalculate_decision_application_status(target_decision_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_result public.decision_result;
  target_scope text;
  task_total integer;
  completed_total integer;
  review_total integer;
  active_total integer;
begin
  select result, scope into target_result, target_scope
  from public.decisions
  where id = target_decision_id;

  if target_result is null then return; end if;

  if target_result = 'rejected' then
    update public.decisions set application_status = null, updated_at = now() where id = target_decision_id;
    return;
  end if;

  if target_scope in ('Bilgi amaçlı', 'Görev alanı dışında') then
    update public.decisions set application_status = 'not_required', updated_at = now() where id = target_decision_id;
    return;
  end if;

  select
    count(*),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'waiting_review'),
    count(*) filter (where status not in ('planned', 'cancelled'))
  into task_total, completed_total, review_total, active_total
  from public.tasks
  where decision_id = target_decision_id and mandatory = true and status <> 'cancelled';

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

-- Recalculate existing decisions once so all menus start from task-derived values.
update public.decisions
set application_status = application_status;
