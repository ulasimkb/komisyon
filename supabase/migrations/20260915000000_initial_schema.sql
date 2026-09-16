-- İl Trafik Komisyonu Karar Takip Sistemi
-- Supabase PostgreSQL schema, integrity rules, RLS and private Storage policies.

create extension if not exists pg_trgm;
create extension if not exists unaccent;

create type public.app_role as enum ('admin','coordinator','staff','controller','viewer');
create type public.decision_result as enum ('accepted','rejected','partial','conditional','postponed','other');
create type public.application_status as enum ('not_started','in_progress','partial','awaiting_review','completed','not_required');
create type public.task_status as enum ('planned','in_progress','waiting_reply','waiting_approval','waiting_review','completed','cancelled');
create type public.correspondence_status as enum ('draft','sent','received');

create table public.units (
  id uuid primary key default gen_random_uuid(), name text not null unique, unit_type text not null default 'municipal', active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade, full_name text not null, role public.app_role not null default 'viewer',
  unit_id uuid references public.units(id), active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(), commission_name text not null, meeting_date date not null, meeting_place text,
  created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now()
);

create table public.decision_packages (
  id uuid primary key default gen_random_uuid(), meeting_id uuid references public.meetings(id), commission_name text not null,
  package_no text not null, decision_date date not null, incoming_document_no text, incoming_document_date date,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','verified','needs_review')),
  received_date date, created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(),
  unique(commission_name, package_no, decision_date)
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(), package_id uuid references public.decision_packages(id), package_no text not null,
  item_no text not null, parent_decision_id uuid references public.decisions(id), decision_date date not null, title text not null,
  proposal_text text, decision_text text not null, summary text, result public.decision_result not null, result_explanation text, conditions text,
  scope text not null default 'Değerlendirme bekliyor', unit_scope_id uuid references public.units(id), responsible_unit_name text,
  application_status public.application_status, source_reference text, version integer not null default 1,
  created_by uuid not null default auth.uid() references auth.users(id), updated_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint rejected_has_no_application check (result <> 'rejected' or application_status is null),
  constraint package_item_context unique nulls not distinct (package_no, decision_date, item_no, parent_decision_id)
);

create table public.decision_clauses (
  id uuid primary key default gen_random_uuid(), decision_id uuid not null references public.decisions(id) on delete cascade,
  clause_no text, text text not null, result public.decision_result not null, conditions text, sort_order integer not null default 0,
  unique(decision_id, clause_no)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(), district_id uuid, district_name text not null default 'Merkez', neighborhood text,
  location_type text not null default 'road', name text not null, normalized_name text not null, old_name text,
  description text, latitude numeric(9,6), longitude numeric(9,6), coordinates_verified boolean not null default false,
  created_at timestamptz not null default now(), unique nulls not distinct(name, district_id)
);

create table public.location_aliases (
  id uuid primary key default gen_random_uuid(), location_id uuid not null references public.locations(id) on delete cascade,
  alias text not null, normalized_alias text not null, alias_type text not null default 'alternative', unique(location_id, normalized_alias)
);

create table public.decision_locations (
  decision_id uuid not null references public.decisions(id) on delete cascade, location_id uuid not null references public.locations(id) on delete restrict,
  relation_type text not null default 'regulated' check (relation_type in ('regulated','mentioned','route')), primary key(decision_id,location_id,relation_type)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(), decision_id uuid not null references public.decisions(id) on delete restrict,
  clause_id uuid references public.decision_clauses(id), title text not null, description text, responsible_unit_id uuid references public.units(id),
  responsible_unit_name text not null, assigned_to uuid references auth.users(id), priority text not null default 'normal' check(priority in ('low','normal','high')),
  planned_start_date date, target_end_date date, official_deadline date, actual_start_date date, actual_end_date date,
  status public.task_status not null default 'planned', waiting_reason text, next_action text, completion_description text,
  mandatory boolean not null default true, cancellation_reason text, version integer not null default 1,
  created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint completed_fields check(status <> 'completed' or (actual_end_date is not null and completion_description is not null)),
  constraint cancelled_reason check(status <> 'cancelled' or cancellation_reason is not null)
);

create table public.task_dependencies (
  task_id uuid not null references public.tasks(id) on delete cascade, depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  primary key(task_id,depends_on_task_id), check(task_id <> depends_on_task_id)
);

create table public.correspondence (
  id uuid primary key default gen_random_uuid(), decision_id uuid references public.decisions(id), task_id uuid references public.tasks(id),
  direction text not null check(direction in ('incoming','outgoing')), status public.correspondence_status not null,
  document_no text, document_date date not null, subject text not null, sender_unit text, recipient_unit text, counterparty_unit text not null,
  attachments_note text, sent_at timestamptz, reply_expected boolean not null default false, reply_target_date date,
  reply_to_id uuid references public.correspondence(id), next_followup_date date, created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(), constraint sent_requires_record check(status <> 'sent' or (document_no is not null and sent_at is not null))
);

create table public.documents (
  id uuid primary key default gen_random_uuid(), decision_id uuid references public.decisions(id), package_id uuid references public.decision_packages(id),
  correspondence_id uuid references public.correspondence(id), storage_path text not null unique, original_name text not null,
  mime_type text not null, size_bytes bigint not null check(size_bytes > 0 and size_bytes <= 26214400), sha256 text,
  version_no integer not null default 1, source_page integer, source_paragraph text, uploaded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id) on delete restrict,
  evidence_type text not null check(evidence_type in ('photo','report','reply','inspection')), description text not null,
  occurred_on date not null, document_id uuid references public.documents(id), submitted_by uuid not null default auth.uid() references auth.users(id),
  review_status text not null default 'pending' check(review_status in ('pending','approved','returned')), reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz, review_note text, created_at timestamptz not null default now(),
  constraint review_fields check(review_status='pending' or (reviewed_by is not null and reviewed_at is not null))
);

create table public.decision_relations (
  source_decision_id uuid not null references public.decisions(id), target_decision_id uuid not null references public.decisions(id),
  relation_type text not null check(relation_type in ('changes','revokes','supplements','related')), source_reference text, verified_by uuid references auth.users(id),
  created_at timestamptz not null default now(), primary key(source_decision_id,target_decision_id,relation_type), check(source_decision_id<>target_decision_id)
);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(), file_hash text not null, original_name text not null, status text not null default 'draft',
  warnings jsonb not null default '[]', extracted_data jsonb, approved_at timestamptz, approved_by uuid references auth.users(id),
  created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), unique(file_hash)
);

create table public.audit_log (
  id bigint generated always as identity primary key, table_name text not null, record_id text not null, operation text not null,
  old_values jsonb, new_values jsonb, changed_by uuid default auth.uid(), changed_at timestamptz not null default now()
);

create index decisions_search_idx on public.decisions using gin ((lower(coalesce(title,'')||' '||coalesce(summary,'')||' '||coalesce(decision_text,''))) gin_trgm_ops);
create index decisions_package_idx on public.decisions(package_id);
create index decisions_unit_scope_idx on public.decisions(unit_scope_id);
create index locations_search_idx on public.locations using gin (normalized_name gin_trgm_ops);
create index location_aliases_search_idx on public.location_aliases using gin (normalized_alias gin_trgm_ops);
create index profiles_unit_idx on public.profiles(unit_id);
create index tasks_decision_idx on public.tasks(decision_id);
create index tasks_assigned_idx on public.tasks(assigned_to);
create index tasks_unit_idx on public.tasks(responsible_unit_id);
create index correspondence_decision_idx on public.correspondence(decision_id);

create or replace function public.current_app_role() returns public.app_role language sql stable as $$
  select coalesce((auth.jwt()->'app_metadata'->>'role')::public.app_role, 'viewer'::public.app_role)
$$;
create or replace function public.current_unit_id() returns uuid language sql stable as $$
  select nullif(auth.jwt()->'app_metadata'->>'unit_id','')::uuid
$$;
revoke all on function public.current_app_role(), public.current_unit_id() from public, anon;

create or replace function public.prevent_rejected_decision_task() returns trigger language plpgsql set search_path=public as $$
begin
  if exists(select 1 from public.decisions where id=new.decision_id and result='rejected') then
    raise exception 'Reddedilen karar için uygulama görevi açılamaz.' using errcode='23514';
  end if;
  return new;
end $$;
create trigger tasks_prevent_rejected before insert or update of decision_id on public.tasks for each row execute function public.prevent_rejected_decision_task();

create or replace function public.prevent_invalid_task_dependency() returns trigger language plpgsql set search_path=public as $$
begin
  if exists(with recursive chain(id) as (select new.depends_on_task_id union all select td.depends_on_task_id from public.task_dependencies td join chain c on td.task_id=c.id) select 1 from chain where id=new.task_id) then
    raise exception 'Görev bağımlılığı döngü oluşturamaz.' using errcode='23514';
  end if;
  return new;
end $$;
create trigger task_dependencies_no_cycle before insert or update on public.task_dependencies for each row execute function public.prevent_invalid_task_dependency();

create or replace function public.audit_changes() returns trigger language plpgsql security definer set search_path=public,pg_catalog as $$
begin
  insert into public.audit_log(table_name,record_id,operation,old_values,new_values,changed_by)
  values(tg_table_name,coalesce(new.id,old.id)::text,tg_op,case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end,auth.uid());
  return coalesce(new,old);
end $$;
revoke all on function public.audit_changes() from public, anon, authenticated;
create trigger decisions_audit after insert or update or delete on public.decisions for each row execute function public.audit_changes();
create trigger tasks_audit after insert or update or delete on public.tasks for each row execute function public.audit_changes();
create trigger correspondence_audit after insert or update or delete on public.correspondence for each row execute function public.audit_changes();

create or replace function public.search_decisions(search_term text, page_limit int default 25, page_offset int default 0)
returns table(id uuid,package_no text,item_no text,decision_date date,title text,summary text,result public.decision_result,matching_text text)
language sql stable security invoker set search_path=public as $$
  select d.id,d.package_no,d.item_no,d.decision_date,d.title,d.summary,d.result,
    case when d.title ilike '%'||search_term||'%' then d.title when d.summary ilike '%'||search_term||'%' then d.summary else left(d.decision_text,240) end
  from public.decisions d
  where unaccent(lower(d.title||' '||coalesce(d.summary,'')||' '||d.decision_text||' '||d.package_no)) % unaccent(lower(search_term))
     or exists(select 1 from public.decision_locations dl join public.locations l on l.id=dl.location_id left join public.location_aliases la on la.location_id=l.id where dl.decision_id=d.id and (l.normalized_name % unaccent(lower(search_term)) or la.normalized_alias % unaccent(lower(search_term))))
  order by d.decision_date desc,d.package_no,d.item_no limit page_limit offset page_offset
$$;

-- Explicit API grants (required for projects where new tables are not exposed automatically).
revoke all on all tables in schema public from anon, authenticated;
grant select on public.units,public.profiles,public.meetings,public.decision_packages,public.decisions,public.decision_clauses,public.locations,public.location_aliases,public.decision_locations,public.tasks,public.task_dependencies,public.correspondence,public.documents,public.evidence,public.decision_relations,public.import_jobs,public.audit_log to authenticated;
grant insert,update on public.meetings,public.decision_packages,public.decisions,public.decision_clauses,public.locations,public.location_aliases,public.decision_locations,public.tasks,public.task_dependencies,public.correspondence,public.documents,public.evidence,public.decision_relations,public.import_jobs to authenticated;
grant execute on function public.search_decisions(text,int,int),public.current_app_role(),public.current_unit_id() to authenticated;

alter table public.units enable row level security; alter table public.profiles enable row level security; alter table public.meetings enable row level security;
alter table public.decision_packages enable row level security; alter table public.decisions enable row level security; alter table public.decision_clauses enable row level security;
alter table public.locations enable row level security; alter table public.location_aliases enable row level security; alter table public.decision_locations enable row level security;
alter table public.tasks enable row level security; alter table public.task_dependencies enable row level security; alter table public.correspondence enable row level security;
alter table public.documents enable row level security; alter table public.evidence enable row level security; alter table public.decision_relations enable row level security;
alter table public.import_jobs enable row level security; alter table public.audit_log enable row level security;

-- Authenticated users may read shared reference and decision context. Staff task writes remain unit/assignment scoped.
create policy units_read on public.units for select to authenticated using ((select auth.uid()) is not null);
create policy profiles_self_or_manager_read on public.profiles for select to authenticated using (id=(select auth.uid()) or (select public.current_app_role()) in ('admin','coordinator'));
create policy meetings_read on public.meetings for select to authenticated using ((select auth.uid()) is not null);
create policy packages_read on public.decision_packages for select to authenticated using ((select auth.uid()) is not null);
create policy decisions_read on public.decisions for select to authenticated using (
  (select public.current_app_role()) in ('admin','coordinator')
  or unit_scope_id=(select public.current_unit_id())
  or exists(select 1 from public.tasks t where t.decision_id=id and (t.assigned_to=(select auth.uid()) or t.responsible_unit_id=(select public.current_unit_id())))
);
create policy clauses_read on public.decision_clauses for select to authenticated using ((select auth.uid()) is not null);
create policy locations_read on public.locations for select to authenticated using ((select auth.uid()) is not null);
create policy aliases_read on public.location_aliases for select to authenticated using ((select auth.uid()) is not null);
create policy decision_locations_read on public.decision_locations for select to authenticated using ((select auth.uid()) is not null);
create policy decision_relations_read on public.decision_relations for select to authenticated using ((select auth.uid()) is not null);

create policy managers_create_meetings on public.meetings for insert to authenticated with check ((select public.current_app_role()) in ('admin','coordinator') and created_by=(select auth.uid()));
create policy managers_update_meetings on public.meetings for update to authenticated using ((select public.current_app_role()) in ('admin','coordinator')) with check ((select public.current_app_role()) in ('admin','coordinator'));
create policy managers_create_packages on public.decision_packages for insert to authenticated with check ((select public.current_app_role()) in ('admin','coordinator') and created_by=(select auth.uid()));
create policy managers_update_packages on public.decision_packages for update to authenticated using ((select public.current_app_role()) in ('admin','coordinator')) with check ((select public.current_app_role()) in ('admin','coordinator'));
create policy managers_create_decisions on public.decisions for insert to authenticated with check ((select public.current_app_role()) in ('admin','coordinator') and created_by=(select auth.uid()));
create policy managers_update_decisions on public.decisions for update to authenticated using ((select public.current_app_role()) in ('admin','coordinator')) with check ((select public.current_app_role()) in ('admin','coordinator'));
create policy managers_manage_clauses on public.decision_clauses for all to authenticated using ((select public.current_app_role()) in ('admin','coordinator')) with check ((select public.current_app_role()) in ('admin','coordinator'));
create policy managers_manage_locations on public.locations for all to authenticated using ((select public.current_app_role()) in ('admin','coordinator')) with check ((select public.current_app_role()) in ('admin','coordinator'));
create policy managers_manage_aliases on public.location_aliases for all to authenticated using ((select public.current_app_role()) in ('admin','coordinator')) with check ((select public.current_app_role()) in ('admin','coordinator'));
create policy managers_manage_decision_locations on public.decision_locations for all to authenticated using ((select public.current_app_role()) in ('admin','coordinator')) with check ((select public.current_app_role()) in ('admin','coordinator'));
create policy managers_manage_relations on public.decision_relations for all to authenticated using ((select public.current_app_role()) in ('admin','coordinator')) with check ((select public.current_app_role()) in ('admin','coordinator'));

create policy tasks_scoped_read on public.tasks for select to authenticated using ((select public.current_app_role()) in ('admin','coordinator','controller','viewer') or assigned_to=(select auth.uid()) or responsible_unit_id=(select public.current_unit_id()));
create policy tasks_scoped_insert on public.tasks for insert to authenticated with check ((select public.current_app_role()) in ('admin','coordinator') or ((select public.current_app_role())='staff' and responsible_unit_id=(select public.current_unit_id())));
create policy tasks_scoped_update on public.tasks for update to authenticated using ((select public.current_app_role()) in ('admin','coordinator','controller') or assigned_to=(select auth.uid()) or responsible_unit_id=(select public.current_unit_id())) with check ((select public.current_app_role()) in ('admin','coordinator','controller') or assigned_to=(select auth.uid()) or responsible_unit_id=(select public.current_unit_id()));
create policy dependencies_read on public.task_dependencies for select to authenticated using (exists(select 1 from public.tasks t where t.id=task_id));
create policy managers_dependencies_write on public.task_dependencies for all to authenticated using ((select public.current_app_role()) in ('admin','coordinator')) with check ((select public.current_app_role()) in ('admin','coordinator'));
create policy correspondence_read on public.correspondence for select to authenticated using ((select public.current_app_role()) in ('admin','coordinator','controller','viewer') or exists(select 1 from public.tasks t where t.id=task_id));
create policy correspondence_insert on public.correspondence for insert to authenticated with check ((select public.current_app_role()) in ('admin','coordinator','staff') and created_by=(select auth.uid()));
create policy correspondence_update on public.correspondence for update to authenticated using ((select public.current_app_role()) in ('admin','coordinator') or created_by=(select auth.uid())) with check ((select public.current_app_role()) in ('admin','coordinator') or created_by=(select auth.uid()));
create policy documents_read on public.documents for select to authenticated using (
  (select public.current_app_role()) in ('admin','coordinator','controller')
  or uploaded_by=(select auth.uid())
  or exists(select 1 from public.decisions d where d.id=decision_id)
);
create policy documents_insert on public.documents for insert to authenticated with check (uploaded_by=(select auth.uid()) and (select public.current_app_role()) in ('admin','coordinator','staff'));
create policy evidence_read on public.evidence for select to authenticated using (exists(select 1 from public.tasks t where t.id=task_id));
create policy evidence_insert on public.evidence for insert to authenticated with check (submitted_by=(select auth.uid()) and exists(select 1 from public.tasks t where t.id=task_id));
create policy evidence_review on public.evidence for update to authenticated using ((select public.current_app_role()) in ('admin','controller')) with check ((select public.current_app_role()) in ('admin','controller'));
create policy imports_owner_read on public.import_jobs for select to authenticated using ((select public.current_app_role()) in ('admin','coordinator') or created_by=(select auth.uid()));
create policy imports_create on public.import_jobs for insert to authenticated with check (created_by=(select auth.uid()) and (select public.current_app_role()) in ('admin','coordinator'));
create policy imports_update on public.import_jobs for update to authenticated using ((select public.current_app_role()) in ('admin','coordinator')) with check ((select public.current_app_role()) in ('admin','coordinator'));
create policy audit_read on public.audit_log for select to authenticated using ((select public.current_app_role()) in ('admin','coordinator','controller'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('commission-documents','commission-documents',false,26214400,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy commission_files_read on storage.objects for select to authenticated using (
  bucket_id='commission-documents'
  and exists(select 1 from public.documents d where d.storage_path=name)
);
create policy commission_files_insert on storage.objects for insert to authenticated with check (bucket_id='commission-documents' and (select public.current_app_role()) in ('admin','coordinator','staff') and owner_id=(select auth.uid())::text);

-- First administrator: create the Auth user in Supabase, then assign app_metadata.role='admin'.
-- Do not store roles in user_metadata; users can edit that field themselves.
