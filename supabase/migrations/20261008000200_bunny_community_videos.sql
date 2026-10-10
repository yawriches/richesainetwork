-- Bunny Stream community video support: paid-member quotas, private lifecycle metadata, and auditable moderation.
begin;

alter table public.community_settings
  add column if not exists video_enabled boolean not null default true,
  add column if not exists video_posts_per_day integer not null default 1 check (video_posts_per_day between 0 and 5),
  add column if not exists max_active_videos integer not null default 3 check (max_active_videos between 1 and 20),
  add column if not exists max_video_upload_mb integer not null default 250 check (max_video_upload_mb between 25 and 1000),
  add column if not exists max_video_duration_seconds integer not null default 180 check (max_video_duration_seconds between 15 and 600);

create table if not exists public.community_videos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid unique references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  bunny_video_id uuid unique,
  source_filename text not null check (char_length(source_filename) between 1 and 255),
  mime_type text not null check (mime_type in ('video/mp4','video/quicktime','video/webm')),
  declared_size_bytes bigint not null check (declared_size_bytes between 1 and 1048576000),
  storage_size_bytes bigint,
  duration_seconds integer,
  bunny_status integer not null default 0 check (bunny_status between 0 and 8),
  status text not null default 'RESERVED' check (status in ('RESERVED','UPLOAD_CREATED','UPLOADED','PROCESSING','READY','FAILED','REJECTED','HIDDEN','DELETED','EXPIRED')),
  upload_expires_at timestamptz,
  processing_error text not null default '' check (char_length(processing_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_videos_author_status_idx on public.community_videos(author_id, status, created_at desc);
create index if not exists community_videos_post_idx on public.community_videos(post_id) where post_id is not null;
create index if not exists community_videos_pending_idx on public.community_videos(status, upload_expires_at) where post_id is null;

create trigger community_videos_updated_at before update on public.community_videos
for each row execute function public.touch_updated_at();

alter table public.community_videos enable row level security;
revoke all on public.community_videos from anon, authenticated;
grant all on public.community_videos to service_role;

alter table public.community_moderation_actions
  add column if not exists target_video_id uuid references public.community_videos(id) on delete set null;
alter table public.community_moderation_actions
  drop constraint if exists community_moderation_actions_action_check;
alter table public.community_moderation_actions
  add constraint community_moderation_actions_action_check check (action in (
    'SUSPEND_MEMBER','UNSUSPEND_MEMBER','BAN_MEMBER','UNBAN_MEMBER',
    'HIDE_POST','RESTORE_POST','DELETE_POST',
    'HIDE_COMMENT','RESTORE_COMMENT','DELETE_COMMENT',
    'HIDE_VIDEO','RESTORE_VIDEO','DELETE_VIDEO',
    'RESOLVE_REPORT','UPDATE_SETTINGS'
  ));

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
  videos_today integer := 0;
  active_videos integer := 0;
  last_post_at timestamptz;
  cooldown_remaining integer := 0;
  can_access boolean := false;
  can_post boolean := false;
  can_comment boolean := false;
  can_video_upload boolean := false;
  restriction text := null;
  video_reason text := null;
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
    settings_row.video_enabled := true;
    settings_row.video_posts_per_day := 1;
    settings_row.max_active_videos := 3;
    settings_row.max_video_upload_mb := 250;
    settings_row.max_video_duration_seconds := 180;
  end if;
  select exists(select 1 from public.profiles p where p.id = p_user_id and p.status = 'ACTIVE') into profile_active;
  select exists(select 1 from public.profiles p where p.id = p_user_id and p.role = 'ADMIN' and p.status = 'ACTIVE') into is_admin_user;
  member_active := public.has_membership(p_user_id);
  select * into control_row from public.community_member_controls where user_id = p_user_id;
  select count(*)::integer into posts_today from public.community_posts where author_id = p_user_id and created_at >= day_start and status <> 'DELETED';
  select count(*)::integer into comments_today from public.community_comments where author_id = p_user_id and created_at >= day_start and status <> 'DELETED';
  select count(*)::integer into active_posts from public.community_posts where author_id = p_user_id and status = 'PUBLISHED';
  select count(*)::integer into videos_today from public.community_videos where author_id = p_user_id and created_at >= day_start and status not in ('FAILED','REJECTED','DELETED','EXPIRED');
  select count(*)::integer into active_videos from public.community_videos where author_id = p_user_id and status in ('RESERVED','UPLOAD_CREATED','UPLOADED','PROCESSING','READY');
  select max(created_at) into last_post_at from public.community_posts where author_id = p_user_id and status <> 'DELETED';
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
    posts_today < settings_row.posts_per_day and active_posts < settings_row.max_active_posts and cooldown_remaining = 0
  ));
  can_comment := can_access and (is_admin_user or (
    (control_row.posting_blocked_until is null or control_row.posting_blocked_until <= now()) and comments_today < settings_row.comments_per_day
  ));
  if not settings_row.video_enabled then video_reason := 'COMMUNITY_VIDEO_DISABLED';
  elsif not can_access then video_reason := restriction;
  elsif not is_admin_user and control_row.posting_blocked_until is not null and control_row.posting_blocked_until > now() then video_reason := 'POSTING_BLOCKED';
  elsif not is_admin_user and videos_today >= settings_row.video_posts_per_day then video_reason := 'VIDEOS_DAILY_LIMIT';
  elsif not is_admin_user and active_videos >= settings_row.max_active_videos then video_reason := 'ACTIVE_VIDEO_LIMIT';
  elsif not can_post then video_reason := 'POSTING_LIMIT';
  end if;
  can_video_upload := video_reason is null;
  return jsonb_build_object(
    'can_access', can_access,
    'can_post', can_post,
    'can_comment', can_comment,
    'can_video_upload', can_video_upload,
    'is_admin', is_admin_user,
    'membership_active', member_active,
    'member_status', coalesce(control_row.status, 'ACTIVE'),
    'posting_blocked_until', control_row.posting_blocked_until,
    'reason', restriction,
    'reason_message', case restriction
      when 'PAID_MEMBERSHIP_REQUIRED' then 'A paid membership is required to join the community.'
      when 'COMMUNITY_SUSPENDED' then 'Your community access is temporarily suspended.'
      when 'COMMUNITY_BANNED' then 'Your community access has been suspended permanently.'
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
    'video_reason', video_reason,
    'posts_today', posts_today,
    'comments_today', comments_today,
    'videos_today', videos_today,
    'active_posts', active_posts,
    'active_videos', active_videos,
    'cooldown_remaining', cooldown_remaining,
    'limits', jsonb_build_object(
      'posts_per_day', settings_row.posts_per_day,
      'comments_per_day', settings_row.comments_per_day,
      'post_cooldown_seconds', settings_row.post_cooldown_seconds,
      'max_active_posts', settings_row.max_active_posts,
      'max_post_length', settings_row.max_post_length,
      'max_comment_length', settings_row.max_comment_length,
      'image_size_mb', settings_row.image_size_mb,
      'video_enabled', settings_row.video_enabled,
      'video_posts_per_day', settings_row.video_posts_per_day,
      'max_active_videos', settings_row.max_active_videos,
      'max_video_upload_mb', settings_row.max_video_upload_mb,
      'max_video_duration_seconds', settings_row.max_video_duration_seconds,
      'membership_required', settings_row.membership_required
    )
  );
end;
$$;

create or replace function public.community_video_reserve(
  p_user_id uuid,
  p_source_filename text,
  p_mime_type text,
  p_declared_size_bytes bigint
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  access jsonb;
  limits jsonb;
  video_row public.community_videos%rowtype;
begin
  if p_user_id is null or (p_user_id <> auth.uid() and auth.role() <> 'service_role') then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('community-video:' || p_user_id::text, 0));
  update public.community_videos
  set status = 'EXPIRED', processing_error = 'Unattached upload draft expired.'
  where author_id = p_user_id and post_id is null and status in ('RESERVED','UPLOAD_CREATED','UPLOADED','PROCESSING','READY') and created_at < now() - interval '24 hours';
  access := public.community_access(p_user_id);
  limits := access->'limits';
  if coalesce((access->>'can_video_upload')::boolean, false) is not true then
    raise exception '%', coalesce(access->>'video_reason','COMMUNITY_VIDEO_DISABLED');
  end if;
  if p_source_filename is null or char_length(btrim(p_source_filename)) not between 1 and 255 then raise exception 'Choose a valid video file.'; end if;
  if p_mime_type not in ('video/mp4','video/quicktime','video/webm') then raise exception 'Choose an MP4, MOV, or WebM video.'; end if;
  if p_declared_size_bytes is null or p_declared_size_bytes < 1 or p_declared_size_bytes > ((limits->>'max_video_upload_mb')::bigint * 1024 * 1024) then
    raise exception 'This video exceeds the current community upload size limit.';
  end if;
  insert into public.community_videos(author_id,source_filename,mime_type,declared_size_bytes,status,upload_expires_at)
  values (p_user_id,btrim(p_source_filename),p_mime_type,p_declared_size_bytes,'RESERVED',now() + interval '2 hours')
  returning * into video_row;
  return jsonb_build_object('id',video_row.id,'upload_expires_at',video_row.upload_expires_at,'limits',limits);
end;
$$;

revoke all on function public.community_video_reserve(uuid,text,text,bigint) from public, anon, authenticated;
grant execute on function public.community_video_reserve(uuid,text,text,bigint) to service_role;

create or replace function public.admin_community_moderate(
  p_actor_id uuid,
  p_action text,
  p_target_user_id uuid default null,
  p_target_post_id uuid default null,
  p_target_comment_id uuid default null,
  p_target_report_id uuid default null,
  p_status text default null,
  p_reason text default '',
  p_details jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  old_status text;
  target_author uuid;
  report_post uuid;
  report_reporter uuid;
  settings_row public.community_settings%rowtype;
  control_row public.community_member_controls%rowtype;
  post_row public.community_posts%rowtype;
  comment_row public.community_comments%rowtype;
  report_row public.community_reports%rowtype;
  video_row public.community_videos%rowtype;
  video_uuid uuid;
  result jsonb;
begin
  if not exists(select 1 from public.profiles where id = p_actor_id and role = 'ADMIN' and status = 'ACTIVE') then raise exception 'ADMIN_REQUIRED'; end if;
  if p_reason is null or char_length(p_reason) > 500 then raise exception 'A moderation reason is required'; end if;
  if p_action = 'UPDATE_SETTINGS' then
    insert into public.community_settings(
      id,enabled,membership_required,posts_per_day,comments_per_day,post_cooldown_seconds,max_active_posts,max_post_length,max_comment_length,image_size_mb,
      video_enabled,video_posts_per_day,max_active_videos,max_video_upload_mb,max_video_duration_seconds,updated_by
    ) values (
      true,(p_details->>'enabled')::boolean,(p_details->>'membership_required')::boolean,(p_details->>'posts_per_day')::integer,(p_details->>'comments_per_day')::integer,
      (p_details->>'post_cooldown_seconds')::integer,(p_details->>'max_active_posts')::integer,(p_details->>'max_post_length')::integer,(p_details->>'max_comment_length')::integer,(p_details->>'image_size_mb')::integer,
      (p_details->>'video_enabled')::boolean,(p_details->>'video_posts_per_day')::integer,(p_details->>'max_active_videos')::integer,(p_details->>'max_video_upload_mb')::integer,(p_details->>'max_video_duration_seconds')::integer,p_actor_id
    ) on conflict (id) do update set
      enabled=excluded.enabled,membership_required=excluded.membership_required,posts_per_day=excluded.posts_per_day,comments_per_day=excluded.comments_per_day,
      post_cooldown_seconds=excluded.post_cooldown_seconds,max_active_posts=excluded.max_active_posts,max_post_length=excluded.max_post_length,
      max_comment_length=excluded.max_comment_length,image_size_mb=excluded.image_size_mb,video_enabled=excluded.video_enabled,
      video_posts_per_day=excluded.video_posts_per_day,max_active_videos=excluded.max_active_videos,max_video_upload_mb=excluded.max_video_upload_mb,
      max_video_duration_seconds=excluded.max_video_duration_seconds,updated_by=excluded.updated_by
    returning * into settings_row;
    result := to_jsonb(settings_row);
  elsif p_action in ('SUSPEND_MEMBER','UNSUSPEND_MEMBER','BAN_MEMBER','UNBAN_MEMBER') then
    select status into old_status from public.community_member_controls where user_id = p_target_user_id;
    if p_action = 'UNSUSPEND_MEMBER' and old_status = 'BANNED' then p_action := 'UNBAN_MEMBER'; end if;
    if exists(select 1 from public.profiles where id = p_target_user_id and role = 'ADMIN') then raise exception 'Administrator accounts cannot be community-banned.'; end if;
    insert into public.community_member_controls(user_id,status,posting_blocked_until,reason,updated_by)
    values (p_target_user_id,case when p_action in ('UNSUSPEND_MEMBER','UNBAN_MEMBER') then 'ACTIVE' else p_status end,nullif(p_details->>'posting_blocked_until','')::timestamptz,p_reason,p_actor_id)
    on conflict (user_id) do update set status=excluded.status,posting_blocked_until=excluded.posting_blocked_until,reason=excluded.reason,updated_by=excluded.updated_by
    returning * into control_row;
    result := to_jsonb(control_row);
    p_details := p_details || jsonb_build_object('previous_status',coalesce(old_status,'ACTIVE'),'status',control_row.status);
  elsif p_action in ('HIDE_POST','RESTORE_POST','DELETE_POST') then
    select * into post_row from public.community_posts where id = p_target_post_id for update;
    if not found then raise exception 'Community post was not found'; end if;
    update public.community_posts set status = p_status where id = p_target_post_id returning * into post_row;
    target_author := post_row.author_id;
    result := jsonb_build_object('id',post_row.id,'status',post_row.status);
  elsif p_action in ('HIDE_COMMENT','RESTORE_COMMENT','DELETE_COMMENT') then
    select * into comment_row from public.community_comments where id = p_target_comment_id for update;
    if not found then raise exception 'Community comment was not found'; end if;
    update public.community_comments set status = p_status where id = p_target_comment_id returning * into comment_row;
    target_author := comment_row.author_id;
    result := jsonb_build_object('id',comment_row.id,'status',comment_row.status);
  elsif p_action in ('HIDE_VIDEO','RESTORE_VIDEO','DELETE_VIDEO') then
    video_uuid := nullif(p_details->>'video_id','')::uuid;
    select * into video_row from public.community_videos where id = video_uuid for update;
    if not found then raise exception 'Community video was not found'; end if;
    update public.community_videos set status = p_status where id = video_uuid returning * into video_row;
    target_author := video_row.author_id;
    result := jsonb_build_object('id',video_row.id,'status',video_row.status,'bunny_video_id',video_row.bunny_video_id);
    p_details := p_details || jsonb_build_object('video_id',video_row.id,'bunny_video_id',video_row.bunny_video_id);
  elsif p_action = 'RESOLVE_REPORT' then
    select * into report_row from public.community_reports where id = p_target_report_id for update;
    if not found then raise exception 'Community report was not found'; end if;
    report_post := report_row.post_id;
    report_reporter := report_row.reporter_id;
    select author_id into target_author from public.community_posts where id = report_row.post_id;
    update public.community_reports set status = p_status where id = p_target_report_id returning * into report_row;
    result := jsonb_build_object('id',report_row.id,'status',report_row.status);
    p_target_post_id := report_post;
    p_target_user_id := target_author;
    p_details := p_details || jsonb_build_object('reporter_id',report_reporter);
  else raise exception 'This community moderation action is unavailable.';
  end if;
  insert into public.community_moderation_actions(action,actor_id,target_user_id,target_post_id,target_comment_id,target_report_id,target_video_id,reason,details)
  values (p_action,p_actor_id,coalesce(target_author,p_target_user_id),p_target_post_id,p_target_comment_id,p_target_report_id,video_uuid,p_reason,p_details);
  return result;
end;
$$;

commit;
