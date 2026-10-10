begin;
create function public.provision_test_payment_key(p_provider text,p_secret text) returns boolean language plpgsql security definer set search_path=public as $$
declare sid uuid; v_name text;
begin
 perform public.assert_service_role();
 if p_provider not in ('PAYSTACK','KORA') or p_secret is null or p_secret not like 'sk_test_%' then raise exception 'Only known test-mode merchant credentials are permitted'; end if;
 v_name:='airiches_test_'||lower(p_provider);
 select id into sid from vault.secrets where vault.secrets.name=v_name limit 1;
 if sid is null then perform vault.create_secret(p_secret,v_name,'AI Riches native test payment reconciliation'); else perform vault.update_secret(sid,p_secret,v_name,'AI Riches native test payment reconciliation'); end if;
 return true;
end; $$;
revoke all on function public.provision_test_payment_key(text,text) from public,anon,authenticated;
grant execute on function public.provision_test_payment_key(text,text) to service_role;
create function public.native_test_payment_keys() returns jsonb language plpgsql security definer set search_path=public as $$
begin
 perform public.assert_service_role();
 return coalesce((select jsonb_object_agg(case name when 'airiches_test_paystack' then 'PAYSTACK' else 'KORA' end,decrypted_secret) from vault.decrypted_secrets where name in ('airiches_test_paystack','airiches_test_kora')),'{}'::jsonb);
end; $$;
revoke all on function public.native_test_payment_keys() from public,anon,authenticated;
grant execute on function public.native_test_payment_keys() to service_role;
-- Failed or cancelled verified attempts never grant value and never overwrite success.
create function public.record_payment_failure(p_order_id uuid,p_provider text,p_reference text,p_status text) returns boolean language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype; state text;
begin
 perform public.assert_service_role();
 state:=case lower(p_status) when 'failed' then 'FAILED' when 'cancelled' then 'CANCELLED' when 'abandoned' then 'CANCELLED' else null end;
 if state is null then return false; end if;
 select * into o from public.orders where id=p_order_id and provider=p_provider and reference=p_reference for update;
 if not found or o.status<>'PENDING' then return false; end if;
 update public.orders set status=state where id=o.id;
 insert into public.payments(order_id,user_id,provider,reference,status,amount,currency,verified_at) values(o.id,o.user_id,o.provider,o.reference,state,o.amount,o.currency,now()) on conflict do nothing;
 return true;
end; $$;
revoke all on function public.record_payment_failure(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.record_payment_failure(uuid,text,text,text) to service_role;
commit;
