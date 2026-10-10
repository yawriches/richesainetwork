begin;

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check(char_length(name) between 2 and 100),
  email text not null check(char_length(email) <= 320),
  message text not null check(char_length(message) between 10 and 5000),
  status text not null default 'OPEN' check(status in ('OPEN','CLOSED')),
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from public,anon,authenticated;
grant select,update on public.contact_messages to authenticated;
grant all on public.contact_messages to service_role;
create policy contact_admin_select on public.contact_messages for select to authenticated using(public.is_admin());
create policy contact_admin_update on public.contact_messages for update to authenticated using(public.is_admin()) with check(public.is_admin());
create trigger audit_contact after update on public.contact_messages for each row execute function public.audit_row_change();

create or replace function public.appointment_cancel(p_appointment_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare ap public.appointments%rowtype; notice_hours numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into ap from public.appointments where id=p_appointment_id and user_id=auth.uid() for update;
  if not found or ap.status<>'CONFIRMED' then raise exception 'This appointment cannot be cancelled'; end if;
  select (value #>> '{}')::numeric into notice_hours from public.business_settings where key='booking.cancellation_notice_hours' and active;
  if notice_hours is null then raise exception 'Cancellation policy is not configured'; end if;
  if ap.starts_at<=now()+make_interval(secs=>notice_hours*3600) then raise exception 'The cancellation notice period has passed. Please contact support'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and status='ACTIVE') then raise exception 'Active account required'; end if;
  update public.appointments set status='CANCELLED' where id=ap.id;
  insert into public.notifications(user_id,title,body,url,event_key) values(auth.uid(),'Appointment cancelled','Your support appointment has been cancelled. This does not automatically issue a refund.','/support','appointment.cancel:'||ap.id) on conflict(user_id,event_key) do nothing;
  return jsonb_build_object('id',ap.id,'status','CANCELLED');
end;
$$;

create or replace function public.appointment_reschedule(p_appointment_id uuid,p_availability_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare ap public.appointments%rowtype; slot public.availability%rowtype; notice_hours numeric; occupied bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into ap from public.appointments where id=p_appointment_id and user_id=auth.uid() for update;
  if not found or ap.status<>'CONFIRMED' then raise exception 'This appointment cannot be rescheduled'; end if;
  select (value #>> '{}')::numeric into notice_hours from public.business_settings where key='booking.cancellation_notice_hours' and active;
  if notice_hours is null then raise exception 'Rescheduling policy is not configured'; end if;
  if ap.starts_at<=now()+make_interval(secs=>notice_hours*3600) then raise exception 'The rescheduling notice period has passed. Please contact support'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and status='ACTIVE') then raise exception 'Active account required'; end if;
  select * into slot from public.availability where id=p_availability_id for update;
  if not found or slot.status<>'OPEN' or slot.starts_at<=now() or slot.package_id<>ap.package_id then raise exception 'Choose an available time for the same package'; end if;
  if slot.id=ap.availability_id then return jsonb_build_object('id',ap.id,'status',ap.status); end if;
  select (select count(*) from public.appointments where availability_id=slot.id and status in ('CONFIRMED','COMPLETED'))+(select count(*) from public.booking_holds where availability_id=slot.id and expires_at>now()) into occupied;
  if occupied>=slot.capacity then raise exception 'That time is no longer available'; end if;
  update public.appointments set availability_id=slot.id,starts_at=slot.starts_at,ends_at=slot.ends_at,meeting_url=slot.meeting_url where id=ap.id;
  insert into public.notifications(user_id,title,body,url,event_key) values(auth.uid(),'Appointment rescheduled','Your support appointment now starts at '||slot.starts_at::text||'.','/support','appointment.reschedule:'||ap.id||':'||slot.id) on conflict(user_id,event_key) do nothing;
  return jsonb_build_object('id',ap.id,'status','CONFIRMED','starts_at',slot.starts_at,'ends_at',slot.ends_at);
end;
$$;

revoke all on function public.appointment_cancel(uuid) from public,anon;
revoke all on function public.appointment_reschedule(uuid,uuid) from public,anon;
grant execute on function public.appointment_cancel(uuid),public.appointment_reschedule(uuid,uuid) to authenticated;

alter table public.events add column recording_url text;
alter table public.events add column resources jsonb not null default '[]'::jsonb;
alter table public.ai_drops add column resource_path text;
alter table public.announcements add column url text;

commit;
