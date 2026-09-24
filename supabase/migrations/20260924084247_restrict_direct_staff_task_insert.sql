drop policy tasks_scoped_insert on public.tasks;
create policy tasks_scoped_insert on public.tasks for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (select public.current_app_role()) in ('admin','coordinator')
    or (
      (select public.current_app_role()) = 'staff'
      and responsible_unit_id = (select public.current_unit_id())
      and status = 'planned'
      and mandatory
      and exists (select 1 from public.decisions decision where decision.id = decision_id)
    )
  )
);
