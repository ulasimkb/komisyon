-- Keep the application consistent when an authorized manager deletes a decision.
-- Operational children are removed, while uploaded documents are retained and unlinked.

alter table public.decisions drop constraint if exists decisions_parent_decision_id_fkey;
alter table public.decisions
  add constraint decisions_parent_decision_id_fkey
  foreign key (parent_decision_id) references public.decisions(id) on delete set null;

alter table public.tasks drop constraint if exists tasks_decision_id_fkey;
alter table public.tasks
  add constraint tasks_decision_id_fkey
  foreign key (decision_id) references public.decisions(id) on delete cascade;

alter table public.evidence drop constraint if exists evidence_task_id_fkey;
alter table public.evidence
  add constraint evidence_task_id_fkey
  foreign key (task_id) references public.tasks(id) on delete cascade;

alter table public.correspondence drop constraint if exists correspondence_decision_id_fkey;
alter table public.correspondence
  add constraint correspondence_decision_id_fkey
  foreign key (decision_id) references public.decisions(id) on delete cascade;

alter table public.correspondence drop constraint if exists correspondence_task_id_fkey;
alter table public.correspondence
  add constraint correspondence_task_id_fkey
  foreign key (task_id) references public.tasks(id) on delete set null;

alter table public.documents drop constraint if exists documents_decision_id_fkey;
alter table public.documents
  add constraint documents_decision_id_fkey
  foreign key (decision_id) references public.decisions(id) on delete set null;

alter table public.documents drop constraint if exists documents_correspondence_id_fkey;
alter table public.documents
  add constraint documents_correspondence_id_fkey
  foreign key (correspondence_id) references public.correspondence(id) on delete set null;

alter table public.decision_relations drop constraint if exists decision_relations_source_decision_id_fkey;
alter table public.decision_relations
  add constraint decision_relations_source_decision_id_fkey
  foreign key (source_decision_id) references public.decisions(id) on delete cascade;

alter table public.decision_relations drop constraint if exists decision_relations_target_decision_id_fkey;
alter table public.decision_relations
  add constraint decision_relations_target_decision_id_fkey
  foreign key (target_decision_id) references public.decisions(id) on delete cascade;

grant delete on public.decisions to authenticated;

drop policy if exists managers_delete_decisions on public.decisions;
create policy managers_delete_decisions
on public.decisions
for delete
to authenticated
using ((select public.current_app_role()) in ('admin', 'coordinator'));
