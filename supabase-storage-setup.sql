-- Run this once in Supabase → SQL Editor, AFTER creating the "avatars"
-- bucket (Storage → New bucket → name: avatars → Public bucket: ON).
--
-- Each user's photo is stored at "<user-id>/avatar.<ext>" — these policies
-- let a signed-in user upload/replace/delete only inside their own folder,
-- while anyone can view (needed since the bucket serves plain public URLs).

create policy "Avatars are publicly viewable"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
on storage.objects for insert
with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update their own avatar"
on storage.objects for update
using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own avatar"
on storage.objects for delete
using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
