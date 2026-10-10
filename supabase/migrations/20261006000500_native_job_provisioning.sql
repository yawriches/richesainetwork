begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- Called once from the trusted operator using runtime environment values, then removed.
-- No browser role can execute it or read Vault's decrypted values.
create function public.provision_native_job_key(p_service_key text)
returns boolean language plpgsql security definer set search_path=public as $$
declare secret_id uuid;
begin
  perform public.assert_service_role();
  if p_service_key is null or char_length(p_service_key)<100 or p_service_key not like 'eyJ%' then raise exception 'A legacy service-role JWT is required for the authenticated Edge gateway'; end if;
  select id into secret_id from vault.secrets where name='airiches_service_role_key' limit 1;
  if secret_id is null then perform vault.create_secret(p_service_key,'airiches_service_role_key','AI Riches native platform jobs: server-only credential');
  else perform vault.update_secret(secret_id,p_service_key,'airiches_service_role_key','AI Riches native platform jobs: server-only credential'); end if;
  return true;
end;
$$;
revoke all on function public.provision_native_job_key(text) from public,anon,authenticated;
grant execute on function public.provision_native_job_key(text) to service_role;
commit;
