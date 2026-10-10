begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon,authenticated,service_role;

-- Existing policy dependencies retain their function OIDs after the schema move.
-- Public invoker wrappers preserve the app RPC contracts without exposing definer RPCs.
alter function public.is_admin() set schema private;
alter function public.has_membership(uuid) set schema private;
alter function public.can_access_course(uuid,uuid) set schema private;
create or replace function private.has_membership(p_user_id uuid)
returns boolean language plpgsql stable security definer set search_path=public as $$
begin
  if p_user_id is null then return false; end if;
  if p_user_id is distinct from auth.uid() and not public.is_admin() and auth.role()<>'service_role' then return false; end if;
  if not exists(select 1 from public.profiles where id=p_user_id and status='ACTIVE') then return false; end if;
  return exists(select 1 from public.subscriptions s where s.user_id=p_user_id and s.status in ('ACTIVE','EXPIRING','CANCELLED') and s.period_start<=now() and s.period_end>now());
end;
$$;
create or replace function private.can_access_course(p_user_id uuid,p_course_id uuid)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare c public.courses%rowtype;
begin
  if p_user_id is null or (p_user_id is distinct from auth.uid() and not public.is_admin() and auth.role()<>'service_role') then return false; end if;
  if not exists(select 1 from public.profiles where id=p_user_id and status='ACTIVE') then return false; end if;
  select * into c from public.courses where id=p_course_id;
  if not found or c.status='DRAFT' then return false; end if;
  if public.is_admin() then return true; end if;
  if c.access_type='FREE' then return exists(select 1 from public.enrollments where user_id=p_user_id and course_id=c.id);
  elsif c.access_type='PURCHASE' then return exists(select 1 from public.entitlements where user_id=p_user_id and product_id=c.product_id and kind in ('PURCHASE','ADMIN') and (expires_at is null or expires_at>now()));
  else return public.has_membership(p_user_id); end if;
end;
$$;
create function public.is_admin() returns boolean language sql stable security invoker set search_path=public as $$ select private.is_admin() $$;
create function public.has_membership(p_user_id uuid) returns boolean language sql stable security invoker set search_path=public as $$ select private.has_membership(p_user_id) $$;
create function public.can_access_course(p_user_id uuid,p_course_id uuid) returns boolean language sql stable security invoker set search_path=public as $$ select private.can_access_course(p_user_id,p_course_id) $$;
revoke all on function public.is_admin(),public.has_membership(uuid),public.can_access_course(uuid,uuid) from public;
grant execute on function public.is_admin(),public.has_membership(uuid),public.can_access_course(uuid,uuid) to anon,authenticated,service_role;

create function private.catalog_curriculum()
returns table(course_id uuid,module_id uuid,module_title text,module_sort_order integer,lesson_id uuid,lesson_title text,lesson_sort_order integer)
language sql stable security definer set search_path=public as $$
  select m.course_id,m.id,m.title,m.sort_order,l.id,l.title,l.sort_order
  from public.course_modules m join public.lessons l on l.module_id=m.id join public.courses c on c.id=m.course_id
  where c.status='PUBLISHED' or public.can_access_course(auth.uid(),c.id)
$$;
create function private.catalog_availability()
returns table(id uuid,package_id uuid,starts_at timestamptz,ends_at timestamptz,capacity integer,status text,remaining_capacity integer)
language sql stable security definer set search_path=public as $$
  select a.id,a.package_id,a.starts_at,a.ends_at,a.capacity,a.status,
    greatest(a.capacity-(select count(*) from public.appointments ap where ap.availability_id=a.id and ap.status in ('CONFIRMED','COMPLETED'))::integer
      -(select count(*) from public.booking_holds h where h.availability_id=a.id and h.expires_at>now())::integer,0)
  from public.availability a join public.support_packages p on p.id=a.package_id
  where a.status='OPEN' and a.starts_at>now() and p.status='ACTIVE'
$$;
create function private.catalog_events()
returns table(id uuid,title text,description text,audience text,status text,publish_at timestamptz,starts_at timestamptz,ends_at timestamptz,url text,thumbnail_url text,created_at timestamptz)
language sql stable security definer set search_path=public as $$
  select e.id,e.title,e.description,e.audience,e.status,e.publish_at,e.starts_at,e.ends_at,e.url,e.thumbnail_url,e.created_at
  from public.events e where e.status='PUBLISHED' and e.audience='PUBLIC' and (e.publish_at is null or e.publish_at<=now())
$$;
create function private.catalog_drops()
returns table(id uuid,title text,description text,type text,url text,thumbnail_url text,audience text,status text,publish_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path=public as $$
  select d.id,d.title,d.description,d.type,d.url,d.thumbnail_url,d.audience,d.status,d.publish_at,d.created_at
  from public.ai_drops d where d.status='PUBLISHED' and d.audience='PUBLIC' and (d.publish_at is null or d.publish_at<=now())
$$;
revoke all on all functions in schema private from public;
grant execute on function private.is_admin(),private.has_membership(uuid),private.can_access_course(uuid,uuid),private.catalog_curriculum(),private.catalog_availability(),private.catalog_events(),private.catalog_drops() to anon,authenticated,service_role;
create or replace view public.public_curriculum with(security_invoker=true) as select * from private.catalog_curriculum();
create or replace view public.public_availability with(security_invoker=true) as select * from private.catalog_availability();
create or replace view public.availability_public with(security_invoker=true) as select id,package_id,starts_at,ends_at,capacity,remaining_capacity from private.catalog_availability();
create or replace view public.public_events with(security_invoker=true) as select * from private.catalog_events();
create or replace view public.events_public with(security_invoker=true) as select * from private.catalog_events();
create or replace view public.ai_drops_public with(security_invoker=true) as select * from private.catalog_drops();

commit;
