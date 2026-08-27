-- Run this in Supabase → SQL Editor. Fixes the storage policies to match
-- the bucket's real name "Avatars" (capital A) — the first version of
-- this setup used lowercase "avatars", which never matched anything.

drop policy if exists "Avatars are publicly viewable" on storage.objects;
drop policy if exists "Users can upload their own avatar" on storage.objects;
drop policy if exists "Users can update their own avatar" on storage.objects;
drop policy if exists "Users can delete their own avatar" on storage.objects;

create policy "Avatars are publicly viewable"
on storage.objects for select
using (bucket_id = 'Avatars');

create policy "Users can upload their own avatar"
on storage.objects for insert
with check (bucket_id = 'Avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update their own avatar"
on storage.objects for update
using (bucket_id = 'Avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own avatar"
on storage.objects for delete
using (bucket_id = 'Avatars' and auth.uid()::text = (storage.foldername(name))[1]);
