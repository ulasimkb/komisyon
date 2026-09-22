-- Fix ambiguous 'version' column reference when cancelling tasks on decision rejection
create or replace function public.save_decision_with_locations(
  p_id uuid, p_expected_version integer, p_package_no text, p_item_no text, p_decision_date date, p_title text, p_proposal_text text, p_decision_text text,
  p_result public.decision_result, p_conditions text, p_scope text, p_neighborhood_name text, p_responsible_unit_names text[], p_locations text[]
) returns table(id uuid, version integer) language plpgsql security invoker set search_path='' as $$
declare saved public.decisions; location_name text; location_id uuid;
begin
  if p_id is null then
    insert into public.decisions(package_no,item_no,decision_date,title,proposal_text,decision_text,result,conditions,scope,neighborhood_name,responsible_unit_names,responsible_unit_name,application_status)
    values(p_package_no,p_item_no,p_decision_date,p_title,p_proposal_text,p_decision_text,p_result,nullif(p_conditions,''),p_scope,nullif(p_neighborhood_name,''),case when p_result='rejected' then '{}'::text[] else coalesce(p_responsible_unit_names,'{}'::text[]) end,case when p_result='rejected' then null else p_responsible_unit_names[1] end,case when p_result='rejected' then null when p_scope in ('Bilgi amaçlı','Görev alanı dışında') then 'not_required'::public.application_status else 'not_started'::public.application_status end) returning * into saved;
  else
    if p_result <> 'rejected' and exists (
      select 1 from public.tasks task
      where task.decision_id = p_id
        and task.status <> 'cancelled'
        and not (task.responsible_unit_name = any(coalesce(p_responsible_unit_names, '{}'::text[])))
    ) then
      raise exception 'Aktif veya tamamlanmış görevi bulunan müdürlük karardan çıkarılamaz.' using errcode='23514';
    end if;

    if p_result = 'rejected' then
      update public.tasks as t
      set status='cancelled',
          cancellation_reason=coalesce(nullif(t.cancellation_reason,''), 'Karar sonucu Reddedildi olarak düzeltildi.'),
          version=t.version+1,
          updated_at=now()
      where t.decision_id=p_id and t.status not in ('completed','cancelled');
    end if;

    update public.decisions d set package_no=p_package_no,item_no=p_item_no,decision_date=p_decision_date,title=p_title,proposal_text=p_proposal_text,decision_text=p_decision_text,result=p_result,conditions=nullif(p_conditions,''),scope=p_scope,neighborhood_name=nullif(p_neighborhood_name,''),responsible_unit_names=case when p_result='rejected' then '{}'::text[] else coalesce(p_responsible_unit_names,'{}'::text[]) end,responsible_unit_name=case when p_result='rejected' then null else p_responsible_unit_names[1] end,application_status=case when p_result='rejected' then null when p_scope in ('Bilgi amaçlı','Görev alanı dışında') then 'not_required'::public.application_status when d.application_status is null or d.application_status='not_required' then 'not_started'::public.application_status else d.application_status end,version=d.version+1,updated_at=now(),updated_by=auth.uid() where d.id=p_id and (p_expected_version is null or d.version=p_expected_version) returning d.* into saved;
    if saved.id is null then raise exception 'Karar başka bir kullanıcı tarafından değiştirildi.' using errcode='40001'; end if;
    delete from public.decision_locations where decision_id=p_id;
  end if;

  for location_name in select distinct btrim(value) from unnest(coalesce(p_locations,'{}'::text[])) as supplied(value) where btrim(value)<>'' loop
    insert into public.locations as location(name,normalized_name) values(location_name,lower(location_name)) on conflict (name,district_id) do update set normalized_name=excluded.normalized_name returning location.id into location_id;
    insert into public.decision_locations(decision_id,location_id,relation_type) values(saved.id,location_id,'regulated') on conflict do nothing;
  end loop;
  return query select saved.id,saved.version;
end $$;

revoke all on function public.save_decision_with_locations(uuid,integer,text,text,date,text,text,text,public.decision_result,text,text,text,text[],text[]) from public,anon;
grant execute on function public.save_decision_with_locations(uuid,integer,text,text,date,text,text,text,public.decision_result,text,text,text,text[],text[]) to authenticated;
