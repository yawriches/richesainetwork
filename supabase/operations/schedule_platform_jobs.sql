-- Run manually only after setting these secrets in Supabase Vault and deploying the
-- platform-jobs Edge Function with SUPABASE_SERVICE_ROLE_KEY. This script is NOT run
-- by the schema migration and does not claim a schedule exists until verified.
do $$
begin
  if not exists(select 1 from pg_extension where extname='pg_cron') then
    raise exception 'pg_cron is not enabled; enable the Supabase Cron extension first';
  end if;
  if not exists(select 1 from pg_extension where extname='pg_net') then
    raise exception 'pg_net is not enabled; enable the Supabase Net extension first';
  end if;
  if not exists(select 1 from pg_extension where extname='supabase_vault') then
    raise exception 'Supabase Vault is not enabled; enable Vault before scheduling jobs';
  end if;
  if (select count(*) from vault.decrypted_secrets where name in ('airiches_project_url','airiches_service_role_key')) <> 2 then
    raise exception 'Create Vault secrets airiches_project_url and airiches_service_role_key before scheduling';
  end if;
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname='airiches-platform-jobs';

select cron.schedule(
  'airiches-platform-jobs',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name='airiches_project_url') || '/functions/v1/platform-jobs',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='airiches_service_role_key')
      ),
      body := '{}'::jsonb
    );
  $job$
);

-- Verify scheduling and successful run evidence explicitly after executing:
--   select jobid,jobname,schedule,active from cron.job where jobname='airiches-platform-jobs';
--   select * from cron.job_run_details where jobid=(select jobid from cron.job where jobname='airiches-platform-jobs') order by start_time desc limit 20;
