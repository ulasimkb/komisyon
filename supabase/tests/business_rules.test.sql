begin;
select plan(8);

select has_table('public','decisions','decisions table exists');
select has_table('public','tasks','tasks table exists');
select col_is_null('public','decisions','application_status','application status permits null for rejected decisions');
select policies_are('public','audit_log',array['app_role_required','audit_read'],'audit log requires an assigned role');
select is(public.current_app_role(), null::public.app_role, 'missing application role grants no default viewer access');
select ok((select count(*) = 17 from pg_policies where schemaname='public' and policyname='app_role_required'), 'all application tables require a role');
select ok((select qual not like '%controller%' from pg_policies where schemaname='public' and tablename='tasks' and policyname='tasks_scoped_update'), 'controller cannot update tasks');
select ok(to_regprocedure('public.create_task_v2(uuid,text,text,uuid,text,date,date,date,text,text,text,text,text)') is not null, 'UUID-based task creation is available');

select * from finish();
rollback;
