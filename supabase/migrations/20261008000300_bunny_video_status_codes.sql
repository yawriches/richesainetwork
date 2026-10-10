-- Bunny also emits statuses 9/10 after encoding (caption/description generation).
begin;
alter table public.community_videos
  drop constraint if exists community_videos_bunny_status_check;
alter table public.community_videos
  add constraint community_videos_bunny_status_check check (bunny_status between 0 and 10);
commit;
