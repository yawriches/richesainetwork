-- Riches AI Network member community: text posts, image attachments, comments, reactions, and reports.
begin;

alter table public.profiles add column if not exists avatar_url text;

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  image_path text,
  status text not null default 'PUBLISHED' check (status in ('PUBLISHED','HIDDEN','DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  status text not null default 'PUBLISHED' check (status in ('PUBLISHED','HIDDEN','DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_reactions (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null default 'LIKE' check (reaction in ('LIKE')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  status text not null default 'OPEN' check (status in ('OPEN','REVIEWED','DISMISSED')),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

create index community_posts_feed_idx on public.community_posts(status, created_at desc);
create index community_posts_author_idx on public.community_posts(author_id, created_at desc);
create index community_comments_post_idx on public.community_comments(post_id, created_at);
create index community_comments_author_idx on public.community_comments(author_id, created_at desc);
create index community_reactions_post_idx on public.community_reactions(post_id);
create index community_reports_status_idx on public.community_reports(status, created_at desc);

create trigger community_posts_updated_at before update on public.community_posts
for each row execute function public.touch_updated_at();
create trigger community_comments_updated_at before update on public.community_comments
for each row execute function public.touch_updated_at();

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_reports enable row level security;

create policy community_posts_read on public.community_posts
for select to authenticated
using (
  status = 'PUBLISHED' or public.is_admin()
);
create policy community_posts_insert on public.community_posts
for insert to authenticated
with check (
  author_id = auth.uid()
  and exists(select 1 from public.profiles p where p.id = auth.uid() and p.status = 'ACTIVE')
);
create policy community_posts_update on public.community_posts
for update to authenticated
using (author_id = auth.uid() or public.is_admin())
with check (author_id = auth.uid() or public.is_admin());
create policy community_posts_delete on public.community_posts
for delete to authenticated
using (author_id = auth.uid() or public.is_admin());

create policy community_comments_read on public.community_comments
for select to authenticated
using (
  exists(select 1 from public.community_posts p where p.id = post_id and p.status = 'PUBLISHED')
  or public.is_admin()
);
create policy community_comments_insert on public.community_comments
for insert to authenticated
with check (
  author_id = auth.uid()
  and exists(select 1 from public.profiles p where p.id = auth.uid() and p.status = 'ACTIVE')
  and exists(select 1 from public.community_posts p where p.id = post_id and p.status = 'PUBLISHED')
);
create policy community_comments_update on public.community_comments
for update to authenticated
using (author_id = auth.uid() or public.is_admin())
with check (author_id = auth.uid() or public.is_admin());
create policy community_comments_delete on public.community_comments
for delete to authenticated
using (author_id = auth.uid() or public.is_admin());

create policy community_reactions_read on public.community_reactions
for select to authenticated using (true);
create policy community_reactions_insert on public.community_reactions
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists(select 1 from public.community_posts p where p.id = post_id and p.status = 'PUBLISHED')
);
create policy community_reactions_delete on public.community_reactions
for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create policy community_reports_insert on public.community_reports
for insert to authenticated
with check (
  reporter_id = auth.uid()
  and exists(select 1 from public.community_posts p where p.id = post_id and p.status = 'PUBLISHED')
);
create policy community_reports_admin_read on public.community_reports
for select to authenticated using (public.is_admin());
create policy community_reports_admin_manage on public.community_reports
for update to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('community-media', 'community-media', false, 10485760,
  array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy community_media_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.extension(name)) in ('jpg','jpeg','png','webp','gif')
);
create policy community_media_read on storage.objects
for select to authenticated
using (
  bucket_id = 'community-media'
  and exists(select 1 from public.community_posts p where p.image_path = name and p.status = 'PUBLISHED')
);
create policy community_media_owner_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'community-media'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

revoke all on public.community_posts, public.community_comments, public.community_reactions, public.community_reports from anon;
grant select, insert, update, delete on public.community_posts, public.community_comments, public.community_reactions to authenticated;
grant select, insert, update on public.community_reports to authenticated;
grant all on public.community_posts, public.community_comments, public.community_reactions, public.community_reports to service_role;

commit;
