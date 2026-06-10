-- M12: private exports bucket + per-user-prefix storage policies.
-- Guarded so the migration set also applies cleanly to a plain Postgres
-- (CI harness / local verification) where the storage schema doesn't exist.

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then

    insert into storage.buckets (id, name, public)
    values ('exports', 'exports', false)
    on conflict (id) do nothing;

    -- objects are stored under <user_id>/<filename>
    execute $pol$
      create policy exports_select_own on storage.objects
        for select using (
          bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text
        )
    $pol$;

    execute $pol$
      create policy exports_insert_own on storage.objects
        for insert with check (
          bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text
        )
    $pol$;

    execute $pol$
      create policy exports_delete_own on storage.objects
        for delete using (
          bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text
        )
    $pol$;

  end if;
end
$$;
