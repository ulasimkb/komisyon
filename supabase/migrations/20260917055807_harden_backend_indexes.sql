-- Harden helper functions and keep extensions out of the exposed public schema.
create schema if not exists extensions;
alter extension pg_trgm set schema extensions;
alter extension unaccent set schema extensions;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt()->'app_metadata'->>'role')::public.app_role, 'viewer'::public.app_role)
$$;

create or replace function public.current_unit_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt()->'app_metadata'->>'unit_id','')::uuid
$$;

create or replace function public.search_decisions(search_term text, page_limit int default 25, page_offset int default 0)
returns table(id uuid,package_no text,item_no text,decision_date date,title text,summary text,result public.decision_result,matching_text text)
language sql stable security invoker set search_path='' as $$
  select d.id,d.package_no,d.item_no,d.decision_date,d.title,d.summary,d.result,
    case when d.title ilike '%'||search_term||'%' then d.title when d.summary ilike '%'||search_term||'%' then d.summary else left(d.decision_text,240) end
  from public.decisions d
  where extensions.unaccent(lower(d.title||' '||coalesce(d.summary,'')||' '||d.decision_text||' '||d.package_no))
          operator(extensions.%) extensions.unaccent(lower(search_term))
     or exists(
       select 1
       from public.decision_locations dl
       join public.locations l on l.id=dl.location_id
       left join public.location_aliases la on la.location_id=l.id
       where dl.decision_id=d.id
         and (
           l.normalized_name operator(extensions.%) extensions.unaccent(lower(search_term))
           or la.normalized_alias operator(extensions.%) extensions.unaccent(lower(search_term))
         )
     )
  order by d.decision_date desc,d.package_no,d.item_no
  limit page_limit offset page_offset
$$;

-- Foreign-key indexes used by joins, cascades, RLS policies and cleanup jobs.
create index if not exists correspondence_created_by_idx on public.correspondence(created_by);
create index if not exists correspondence_reply_to_idx on public.correspondence(reply_to_id);
create index if not exists correspondence_task_idx on public.correspondence(task_id);
create index if not exists decision_locations_location_idx on public.decision_locations(location_id);
create index if not exists decision_packages_created_by_idx on public.decision_packages(created_by);
create index if not exists decision_packages_meeting_idx on public.decision_packages(meeting_id);
create index if not exists decision_relations_target_idx on public.decision_relations(target_decision_id);
create index if not exists decision_relations_verified_by_idx on public.decision_relations(verified_by);
create index if not exists decisions_created_by_idx on public.decisions(created_by);
create index if not exists decisions_parent_idx on public.decisions(parent_decision_id);
create index if not exists decisions_updated_by_idx on public.decisions(updated_by);
create index if not exists documents_correspondence_idx on public.documents(correspondence_id);
create index if not exists documents_decision_idx on public.documents(decision_id);
create index if not exists documents_package_idx on public.documents(package_id);
create index if not exists documents_uploaded_by_idx on public.documents(uploaded_by);
create index if not exists evidence_document_idx on public.evidence(document_id);
create index if not exists evidence_reviewed_by_idx on public.evidence(reviewed_by);
create index if not exists evidence_submitted_by_idx on public.evidence(submitted_by);
create index if not exists evidence_task_idx on public.evidence(task_id);
create index if not exists import_jobs_approved_by_idx on public.import_jobs(approved_by);
create index if not exists import_jobs_created_by_idx on public.import_jobs(created_by);
create index if not exists meetings_created_by_idx on public.meetings(created_by);
create index if not exists task_dependencies_depends_on_idx on public.task_dependencies(depends_on_task_id);
create index if not exists tasks_clause_idx on public.tasks(clause_id);
create index if not exists tasks_created_by_idx on public.tasks(created_by);
