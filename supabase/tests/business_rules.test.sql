begin;
select plan(4);

select has_table('public','decisions','decisions table exists');
select has_table('public','tasks','tasks table exists');
select col_is_null('public','decisions','application_status','application status permits null for rejected decisions');
select policies_are('public','audit_log',array['audit_read'],'audit log has read-only client policy');

select * from finish();
rollback;
