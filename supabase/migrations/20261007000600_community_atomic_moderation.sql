-- Prevent report spam and make community admin changes plus audit rows transactional.
begin;

create unique index if not exists community_open_report_unique
on public.community_reports(post_id, reporter_id)
where status = 'OPEN';

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
  result jsonb;
begin
  if not exists(select 1 from public.profiles where id = p_actor_id and role = 'ADMIN' and status = 'ACTIVE') then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_reason is null or char_length(p_reason) > 500 then raise exception 'A moderation reason is required'; end if;

  if p_action = 'UPDATE_SETTINGS' then
    insert into public.community_settings(
      id, enabled, membership_required, posts_per_day, comments_per_day,
      post_cooldown_seconds, max_active_posts, max_post_length,
      max_comment_length, image_size_mb, updated_by
    ) values (
      true,
      (p_details->>'enabled')::boolean,
      (p_details->>'membership_required')::boolean,
      (p_details->>'posts_per_day')::integer,
      (p_details->>'comments_per_day')::integer,
      (p_details->>'post_cooldown_seconds')::integer,
      (p_details->>'max_active_posts')::integer,
      (p_details->>'max_post_length')::integer,
      (p_details->>'max_comment_length')::integer,
      (p_details->>'image_size_mb')::integer,
      p_actor_id
    ) on conflict (id) do update set
      enabled = excluded.enabled,
      membership_required = excluded.membership_required,
      posts_per_day = excluded.posts_per_day,
      comments_per_day = excluded.comments_per_day,
      post_cooldown_seconds = excluded.post_cooldown_seconds,
      max_active_posts = excluded.max_active_posts,
      max_post_length = excluded.max_post_length,
      max_comment_length = excluded.max_comment_length,
      image_size_mb = excluded.image_size_mb,
      updated_by = excluded.updated_by
    returning * into settings_row;
    result := to_jsonb(settings_row);

  elsif p_action in ('SUSPEND_MEMBER','UNSUSPEND_MEMBER','BAN_MEMBER','UNBAN_MEMBER') then
    select status into old_status from public.community_member_controls where user_id = p_target_user_id;
    if p_action = 'UNSUSPEND_MEMBER' and old_status = 'BANNED' then p_action := 'UNBAN_MEMBER'; end if;
    if exists(select 1 from public.profiles where id = p_target_user_id and role = 'ADMIN') then
      raise exception 'Administrator accounts cannot be community-banned.';
    end if;
    insert into public.community_member_controls(user_id,status,posting_blocked_until,reason,updated_by)
    values (
      p_target_user_id,
      case when p_action in ('UNSUSPEND_MEMBER','UNBAN_MEMBER') then 'ACTIVE' else p_status end,
      nullif(p_details->>'posting_blocked_until','')::timestamptz,
      p_reason,
      p_actor_id
    ) on conflict (user_id) do update set
      status = excluded.status,
      posting_blocked_until = excluded.posting_blocked_until,
      reason = excluded.reason,
      updated_by = excluded.updated_by
    returning * into control_row;
    result := to_jsonb(control_row);
    p_details := p_details || jsonb_build_object('previous_status', coalesce(old_status, 'ACTIVE'), 'status', control_row.status);

  elsif p_action in ('HIDE_POST','RESTORE_POST','DELETE_POST') then
    select * into post_row from public.community_posts where id = p_target_post_id for update;
    if not found then raise exception 'Community post was not found'; end if;
    update public.community_posts set status = p_status where id = p_target_post_id returning * into post_row;
    target_author := post_row.author_id;
    result := jsonb_build_object('id', post_row.id, 'status', post_row.status);

  elsif p_action in ('HIDE_COMMENT','RESTORE_COMMENT','DELETE_COMMENT') then
    select * into comment_row from public.community_comments where id = p_target_comment_id for update;
    if not found then raise exception 'Community comment was not found'; end if;
    update public.community_comments set status = p_status where id = p_target_comment_id returning * into comment_row;
    target_author := comment_row.author_id;
    result := jsonb_build_object('id', comment_row.id, 'status', comment_row.status);

  elsif p_action = 'RESOLVE_REPORT' then
    select * into report_row from public.community_reports where id = p_target_report_id for update;
    if not found then raise exception 'Community report was not found'; end if;
    report_post := report_row.post_id;
    report_reporter := report_row.reporter_id;
    select author_id into target_author from public.community_posts where id = report_row.post_id;
    update public.community_reports set status = p_status where id = p_target_report_id returning * into report_row;
    result := jsonb_build_object('id', report_row.id, 'status', report_row.status);
    p_target_post_id := report_post;
    p_target_user_id := target_author;
    p_details := p_details || jsonb_build_object('reporter_id', report_reporter);
  else
    raise exception 'This community moderation action is unavailable.';
  end if;

  insert into public.community_moderation_actions(
    action, actor_id, target_user_id, target_post_id, target_comment_id,
    target_report_id, reason, details
  ) values (
    p_action, p_actor_id, coalesce(target_author, p_target_user_id), p_target_post_id,
    p_target_comment_id, p_target_report_id, p_reason, p_details
  );
  return result;
end;
$$;

revoke all on function public.admin_community_moderate(uuid,text,uuid,uuid,uuid,uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.admin_community_moderate(uuid,text,uuid,uuid,uuid,uuid,text,text,jsonb) to service_role;

commit;
