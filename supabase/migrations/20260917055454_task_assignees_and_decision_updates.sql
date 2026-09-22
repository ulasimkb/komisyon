alter table public.tasks
add column if not exists assigned_person_name text;

grant delete on public.decision_locations to authenticated;

create or replace function private.prevent_rejection_with_tasks()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.result = 'rejected'
     and old.result <> 'rejected'
     and exists (
       select 1 from public.tasks
       where decision_id = new.id
     ) then
    raise exception 'Bağlı görevi bulunan karar reddedilemez.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_rejection_with_tasks()
from public, anon, authenticated;

drop trigger if exists decisions_prevent_rejection_with_tasks on public.decisions;
create trigger decisions_prevent_rejection_with_tasks
before update of result on public.decisions
for each row execute function private.prevent_rejection_with_tasks();
