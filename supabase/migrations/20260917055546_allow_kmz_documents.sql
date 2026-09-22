do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='storage' and table_name='buckets' and column_name='allowed_mime_types'
  ) then
    execute $sql$
      update storage.buckets
      set allowed_mime_types = array[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'application/vnd.google-earth.kmz'
      ]
      where id = 'commission-documents'
    $sql$;
  end if;
end $$;
