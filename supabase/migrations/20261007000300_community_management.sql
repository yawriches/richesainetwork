-- Paid-member community access, configurable limits, member controls, and moderation audit.
begin;

create table public.community_settings (
  id boolean primary key default true check (id = true),
  enabled boolean not null default true,
  membership_required boolean not null default true,
  posts_per_day integer not null default 5 check (posts_per_day between 0 and 100),
  comments_per_day integer not null default 20 check (comments_per_day between 0 and 500),
  post_cooldown_seconds integer not null default 300 check (post_cooldown_seconds between 0 and 86400),
  max_active_posts integer not null default 20 check (max_active_posts between 1 and 500),
  max_post_length integer not null default 2000 check (max_post_length between 50 and 2000),
  max_comment_length integer not null default 1000 check (max_comment_length between 20 and 1000),
  image_size_mb integer not null default 10 check (image_size_mb between 1 and 10),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.community_settings(id) values (true) on conflict (id) do nothing;

create table public.community_member_controls (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','BANNED')),
  posting_blocked_until timestamptz,
  reason text not null default '' check (char_length(reason) <= 500),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in (
    'SUSPEND_MEMBER','UNSUSPEND_MEMBER','BAN_MEMBER','UNBAN_MEMBER',
    'HIDE_POST','RESTORE_POST','DELETE_POST',
    'HIDE_COMMENT','RESTORE_COMMENT','DELETE_COMMENT',
    'RESOLVE_REPORT','UPDATE_SETTINGS'
  )),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  target_user_id uuid references public.profiles(id) on delete set null,
  target_post_id uuid references public.community_posts(id) on delete set null,
  target_comment_id uuid references public.community_comments(id) on delete set null,
  target_report_id uuid references public.community_reports(id) on delete set null,
  reason text not null default '' check (char_length(reason) <= 500),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index community_controls_status_idx on public.community_member_controls(status, updated_at desc);
create index community_moderation_actor_idx on public.community_moderation_actions(actor_id, created_at desc);
create index community_moderation_target_idx on public.community_moderation_actions(target_user_id, created_at desc);
create index community_moderation_post_idx on public.community_moderation_actions(target_post_id, created_at desc);

create trigger community_settings_updated_at before update on public.community_settings
for each row execute function public.touch_updated_at();
create trigger community_controls_updated_at before update on public.community_member_controls
for each row execute function public.touch_updated_at();

create or replace function public.community_access(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  settings_row public.community_settings%rowtype;
  control_row public.community_member_controls%rowtype;
  member_active boolean := false;
  is_admin_user boolean := false;
  profile_active boolean := false;
  day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  posts_today integer := 0;
  comments_today integer := 0;
  active_posts integer := 0;
  last_post_at timestamptz;
  cooldown_remaining integer := 0;
  can_access boolean := false;
  can_post boolean := false;
  can_comment boolean := false;
  restriction text := null;
begin
  if p_user_id is null or (p_user_id <> uid and not public.is_admin() and auth.role() <> 'service_role') then
    return jsonb_build_object('can_access', false, 'reason', 'AUTH_REQUIRED');
  end if;
  select * into settings_row from public.community_settings where id = true;
  if not found then
    settings_row.enabled := true;
    settings_row.membership_required := true;
    settings_row.posts_per_day := 5;
    settings_row.comments_per_day := 20;
    settings_row.post_cooldown_seconds := 300;
    settings_row.max_active_posts := 20;
    settings_row.max_post_length := 2000;
    settings_row.max_comment_length := 1000;
    settings_row.image_size_mb := 10;
  end if;
  select exists(select 1 from public.profiles p where p.id = p_user_id and p.status = 'ACTIVE') into profile_active;
  select exists(select 1 from public.profiles p where p.id = p_user_id and p.role = 'ADMIN' and p.status = 'ACTIVE') into is_admin_user;
  member_active := public.has_membership(p_user_id);
  select * into control_row from public.community_member_controls where user_id = p_user_id;
  select count(*)::integer into posts_today from public.community_posts
    where author_id = p_user_id and created_at >= day_start and status <> 'DELETED';
  select count(*)::integer into comments_today from public.community_comments
    where author_id = p_user_id and created_at >= day_start and status <> 'DELETED';
  select count(*)::integer into active_posts from public.community_posts
    where author_id = p_user_id and status = 'PUBLISHED';
  select max(created_at) into last_post_at from public.community_posts
    where author_id = p_user_id and status <> 'DELETED';
  if last_post_at is not null and settings_row.post_cooldown_seconds > 0 then
    cooldown_remaining := greatest(0, settings_row.post_cooldown_seconds - extract(epoch from (now() - last_post_at))::integer);
  end if;
  if not settings_row.enabled and not is_admin_user then restriction := 'COMMUNITY_DISABLED';
  elsif not profile_active and not is_admin_user then restriction := 'PROFILE_INACTIVE';
  elsif settings_row.membership_required and not member_active and not is_admin_user then restriction := 'PAID_MEMBERSHIP_REQUIRED';
  elsif control_row.status = 'BANNED' and not is_admin_user then restriction := 'COMMUNITY_BANNED';
  elsif control_row.status = 'SUSPENDED' and not is_admin_user then restriction := 'COMMUNITY_SUSPENDED';
  end if;
  can_access := restriction is null;
  can_post := can_access and (is_admin_user or (
    (control_row.posting_blocked_until is null or control_row.posting_blocked_until <= now()) and
    posts_today < settings_row.posts_per_day and
    active_posts < settings_row.max_active_posts and
    cooldown_remaining = 0
  ));
  can_comment := can_access and (is_admin_user or (
    (control_row.posting_blocked_until is null or control_row.posting_blocked_until <= now()) and
    comments_today < settings_row.comments_per_day
  ));
  return jsonb_build_object(
    'can_access', can_access,
    'can_post', can_post,
    'can_comment', can_comment,
    'is_admin', is_admin_user,
    'membership_active', member_active,
    'member_status', coalesce(control_row.status, 'ACTIVE'),
    'posting_blocked_until', control_row.posting_blocked_until,
    'reason', restriction,
    'reason_message', case restriction
      when 'PAID_MEMBERSHIP_REQUIRED' then 'A paid membership is required to join the community.'
      when 'COMMUNITY_SUSPENDED' then 'Your community access is temporarily suspended.'
      when 'COMMUNITY_BANNED' then 'Your community access has been suspended permanently.'
      when 'POSTING_BLOCKED' then 'Posting is temporarily restricted for your account.'
      when 'COMMUNITY_DISABLED' then 'The community is temporarily unavailable.'
      else null end,
    'posting_reason', case
      when control_row.posting_blocked_until is not null and control_row.posting_blocked_until > now() then 'POSTING_BLOCKED'
      when posts_today >= settings_row.posts_per_day then 'POSTS_DAILY_LIMIT'
      when active_posts >= settings_row.max_active_posts then 'ACTIVE_POST_LIMIT'
      when cooldown_remaining > 0 then 'POST_COOLDOWN'
      else null end,
    'comment_reason', case
      when control_row.posting_blocked_until is not null and control_row.posting_blocked_until > now() then 'POSTING_BLOCKED'
      when comments_today >= settings_row.comments_per_day then 'COMMENTS_DAILY_LIMIT'
      else null end,
    'posts_today', posts_today,
    'comments_today', comments_today,
    'active_posts', active_posts,
    'cooldown_remaining', cooldown_remaining,
    'limits', jsonb_build_object(
      'posts_per_day', settings_row.posts_per_day,
      'comments_per_day', settings_row.comments_per_day,
      'post_cooldown_seconds', settings_row.post_cooldown_seconds,
      'max_active_posts', settings_row.max_active_posts,
      'max_post_length', settings_row.max_post_length,
      'max_comment_length', settings_row.max_comment_length,
      'image_size_mb', settings_row.image_size_mb,
      'membership_required', settings_row.membership_required
    )
  );
end;
$$;

create or replace function public.community_can_view(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((public.community_access(p_user_id)->>'can_access')::boolean, false)
$$;
create or replace function public.community_can_post(p_user_id uuid)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('community-post:' || p_user_id::text, 0));
  return coalesce((public.community_access(p_user_id)->>'can_post')::boolean, false);
end;
$$;
create or replace function public.community_can_comment(p_user_id uuid)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('community-comment:' || p_user_id::text, 0));
  return coalesce((public.community_access(p_user_id)->>'can_comment')::boolean, false);
end;
$$;

grant execute on function public.community_access(uuid), public.community_can_view(uuid), public.community_can_post(uuid), public.community_can_comment(uuid) to authenticated, service_role;

-- Replace the foundation policies with paid-member and moderation-aware policies.
drop policy if exists community_posts_read on public.community_posts;
drop policy if exists community_posts_insert on public.community_posts;
drop policy if exists community_posts_update on public.community_posts;
drop policy if exists community_posts_delete on public.community_posts;
create policy community_posts_read on public.community_posts
for select to authenticated using (public.community_can_view(auth.uid()) or public.is_admin());
create policy community_posts_insert on public.community_posts
for insert to authenticated with check (author_id = auth.uid() and public.community_can_post(auth.uid()));
create policy community_posts_update on public.community_posts
for update to authenticated using (author_id = auth.uid() or public.is_admin()) with check (author_id = auth.uid() or public.is_admin());
create policy community_posts_delete on public.community_posts
for delete to authenticated using (author_id = auth.uid() or public.is_admin());

drop policy if exists community_comments_read on public.community_comments;
drop policy if exists community_comments_insert on public.community_comments;
drop policy if exists community_comments_update on public.community_comments;
drop policy if exists community_comments_delete on public.community_comments;
create policy community_comments_read on public.community_comments
for select to authenticated using (public.community_can_view(auth.uid()) or public.is_admin());
create policy community_comments_insert on public.community_comments
for insert to authenticated with check (
  author_id = auth.uid() and public.community_can_comment(auth.uid()) and
  exists(select 1 from public.community_posts p where p.id = post_id and p.status = 'PUBLISHED')
);
create policy community_comments_update on public.community_comments
for update to authenticated using (author_id = auth.uid() or public.is_admin()) with check (author_id = auth.uid() or public.is_admin());
create policy community_comments_delete on public.community_comments
for delete to authenticated using (author_id = auth.uid() or public.is_admin());

drop policy if exists community_reactions_read on public.community_reactions;
drop policy if exists community_reactions_insert on public.community_reactions;
drop policy if exists community_reactions_delete on public.community_reactions;
create policy community_reactions_read on public.community_reactions
for select to authenticated using (public.community_can_view(auth.uid()) or public.is_admin());
create policy community_reactions_insert on public.community_reactions
for insert to authenticated with check (
  user_id = auth.uid() and public.community_can_view(auth.uid()) and
  exists(select 1 from public.community_posts p where p.id = post_id and p.status = 'PUBLISHED')
);
create policy community_reactions_delete on public.community_reactions
for delete to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists community_reports_insert on public.community_reports;
create policy community_reports_insert on public.community_reports
for insert to authenticated with check (
  reporter_id = auth.uid() and public.community_can_view(auth.uid()) and
  exists(select 1 from public.community_posts p where p.id = post_id and p.status = 'PUBLISHED')
);

drop policy if exists community_media_owner_insert on storage.objects;
create policy community_media_owner_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'community-media' and public.community_can_view(auth.uid()) and
  (storage.foldername(name))[1] = auth.uid()::text and
  (storage.extension(name)) in ('jpg','jpeg','png','webp','gif')
);
drop policy if exists community_media_read on storage.objects;
create policy community_media_read on storage.objects
for select to authenticated using (
  bucket_id = 'community-media' and public.community_can_view(auth.uid()) and
  exists(select 1 from public.community_posts p where p.image_path = name and p.status = 'PUBLISHED')
);

alter table public.community_settings enable row level security;
alter table public.community_member_controls enable row level security;
alter table public.community_moderation_actions enable row level security;
create policy community_settings_admin on public.community_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy community_controls_admin on public.community_member_controls for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy community_moderation_admin on public.community_moderation_actions for select to authenticated using (public.is_admin());
revoke all on public.community_settings, public.community_member_controls, public.community_moderation_actions from anon;
grant select, insert, update, delete on public.community_settings, public.community_member_controls to authenticated;
grant select on public.community_moderation_actions to authenticated;
grant all on public.community_settings, public.community_member_controls, public.community_moderation_actions to service_role;

commit;
