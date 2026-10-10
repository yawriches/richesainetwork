-- Align applied settings with the existing community schema and prevent direct-storage quota bypasses.
begin;

alter table public.community_settings drop constraint if exists community_settings_max_post_length_check;
alter table public.community_settings add constraint community_settings_max_post_length_check check (max_post_length between 50 and 2000);
alter table public.community_settings drop constraint if exists community_settings_max_comment_length_check;
alter table public.community_settings add constraint community_settings_max_comment_length_check check (max_comment_length between 20 and 1000);
alter table public.community_settings drop constraint if exists community_settings_image_size_mb_check;
alter table public.community_settings add constraint community_settings_image_size_mb_check check (image_size_mb between 1 and 10);

update public.community_settings
set max_post_length = least(max_post_length, 2000),
    max_comment_length = least(max_comment_length, 1000),
    image_size_mb = least(image_size_mb, 10)
where id = true;

drop policy if exists community_media_owner_insert on storage.objects;
create policy community_media_owner_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'community-media' and public.community_can_post(auth.uid()) and
  (storage.foldername(name))[1] = auth.uid()::text and
  (storage.extension(name)) in ('jpg','jpeg','png','webp','gif')
);

commit;
