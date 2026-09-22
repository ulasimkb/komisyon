-- A commission decision has one primary implementation assignment.
-- The advisory transaction lock also prevents two simultaneous inserts from
-- creating duplicate tasks for the same decision.
create or replace function private.prevent_duplicate_decision_task()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.decision_id::text, 0));

  if exists (
    select 1
    from public.tasks task
    where task.decision_id = new.decision_id
      and task.id <> new.id
  ) then
    raise exception 'Bu karara daha önce görev atanmış.' using errcode = '23505';
  end if;

  return new;
end
$$;

revoke all on function private.prevent_duplicate_decision_task() from public, anon, authenticated;

drop trigger if exists tasks_prevent_duplicate_decision on public.tasks;
create trigger tasks_prevent_duplicate_decision
before insert or update of decision_id on public.tasks
for each row execute function private.prevent_duplicate_decision_task();
