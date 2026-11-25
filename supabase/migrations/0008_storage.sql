-- 0008_storage.sql
-- Storage buckets.
--   avatars        private, one folder per user
--   meal-photos    private, one folder per user, only after explicit consent
--   model-artifacts public read (artifacts are checksum-verified, not secret)
--   food-images    public read reference photography

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 2097152, array['image/jpeg','image/png','image/webp']),
  ('meal-photos', 'meal-photos', false, 8388608, array['image/jpeg','image/png','image/webp','image/heic']),
  ('model-artifacts', 'model-artifacts', true, 104857600, array['application/octet-stream','application/zip']),
  ('food-images', 'food-images', true, 4194304, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Private buckets: each user may only touch their own folder (uuid as first path segment).
do $$
declare
  bucket text;
begin
  foreach bucket in array array['avatars','meal-photos'] loop
    execute format('drop policy if exists %I on storage.objects', bucket || '_read_own');
    execute format(
      'create policy %I on storage.objects for select to authenticated using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
      bucket || '_read_own', bucket);
    execute format('drop policy if exists %I on storage.objects', bucket || '_write_own');
    execute format(
      'create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
      bucket || '_write_own', bucket);
    execute format('drop policy if exists %I on storage.objects', bucket || '_update_own');
    execute format(
      'create policy %I on storage.objects for update to authenticated using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
      bucket || '_update_own', bucket);
    execute format('drop policy if exists %I on storage.objects', bucket || '_delete_own');
    execute format(
      'create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
      bucket || '_delete_own', bucket);
  end loop;
end $$;

-- Public buckets: anyone may read; only the service role writes (RLS denies
-- writes for anon/authenticated by default since no insert policy exists).
do $$
declare
  bucket text;
begin
  foreach bucket in array array['model-artifacts','food-images'] loop
    execute format('drop policy if exists %I on storage.objects', bucket || '_public_read');
    execute format(
      'create policy %I on storage.objects for select to anon, authenticated using (bucket_id = %L)',
      bucket || '_public_read', bucket);
  end loop;
end $$;
