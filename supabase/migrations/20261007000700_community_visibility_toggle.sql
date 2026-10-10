-- Public read-only visibility flag for reversible community shutdowns.
begin;

create or replace function public.community_is_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from public.community_settings where id = true), true);
$$;

revoke all on function public.community_is_enabled() from public;
grant execute on function public.community_is_enabled() to anon, authenticated, service_role;

commit;
