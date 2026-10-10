begin;
alter table public.payments add column provider_transaction_reference text;
create index payments_provider_transaction_idx on public.payments(provider,provider_transaction_reference);
alter table public.orders add column fulfillment_status text not null default 'PENDING' check(fulfillment_status in ('PENDING','FULFILLED','REQUIRES_ACTION','REFUNDED'));
update public.orders set fulfillment_status='FULFILLED' where status='SUCCESS';
create function public.track_order_fulfillment() returns trigger language plpgsql set search_path=public as $$
begin
 if new.status='SUCCESS' and old.status is distinct from new.status and new.fulfillment_status='PENDING' then new.fulfillment_status:='FULFILLED'; end if;
 if new.status='REFUNDED' then new.fulfillment_status:='REFUNDED'; end if;
 return new;
end; $$;
revoke all on function public.track_order_fulfillment() from public,anon,authenticated;
create trigger order_fulfillment_state before update on public.orders for each row execute function public.track_order_fulfillment();
create table public.payment_refunds(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete restrict,
 user_id uuid not null references public.profiles(id) on delete restrict,
 provider text not null references public.payment_providers(code),
 refund_reference text not null,
 amount bigint not null check(amount>0),
 currency text not null references public.currencies(code),
 status text not null default 'SUCCESS' check(status='SUCCESS'),
 access_policy text not null check(access_policy in ('KEEP_ACCESS','REVOKE_FULL')),
 created_at timestamptz not null default now(),
 unique(provider,refund_reference)
);
alter table public.payment_refunds enable row level security;
revoke all on public.payment_refunds from anon,authenticated;
grant select on public.payment_refunds to authenticated;
grant all on public.payment_refunds to service_role;
create policy refund_history_self on public.payment_refunds for select to authenticated using(user_id=auth.uid() or public.is_admin());
create trigger refund_audit after insert or update or delete on public.payment_refunds for each row execute function public.audit_row_change();
create trigger entitlement_audit after insert or update or delete on public.entitlements for each row execute function public.audit_row_change();
insert into public.business_settings(key,value,type,category,description,active,is_public,allowed_values) values
 ('refund.access_policy','"REVOKE_FULL"'::jsonb,'STRING','payments','Only provider-confirmed full refunds apply this policy. Purchase/progress/review history is retained. No refund initiation is performed.',true,false,'["KEEP_ACCESS","REVOKE_FULL"]'::jsonb)
on conflict(key) do nothing;
create function public.record_verified_refund(p_order_id uuid,p_provider text,p_refund_id text,p_amount bigint,p_currency text) returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype; existing public.payment_refunds%rowtype; total bigint; policy text;
begin
 perform public.assert_service_role();
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.provider<>p_provider or o.currency<>p_currency or o.status not in ('SUCCESS','REFUNDED') then raise exception 'Verified refund does not match a paid order'; end if;
 if p_amount<=0 or p_amount>o.amount or length(coalesce(p_refund_id,''))<1 then raise exception 'Invalid verified refund amount/reference'; end if;
 select * into existing from public.payment_refunds where provider=p_provider and refund_reference=p_refund_id;
 if found then if existing.order_id<>o.id or existing.amount<>p_amount or existing.currency<>p_currency then raise exception 'Refund reference conflict'; end if;
 else
  select coalesce(sum(amount),0) into total from public.payment_refunds where order_id=o.id;
  if total+p_amount>o.amount then raise exception 'Total refunds exceed the original order'; end if;
  select value #>> '{}' into policy from public.business_settings where key='refund.access_policy' and active;
  if policy not in ('KEEP_ACCESS','REVOKE_FULL') or policy is null then raise exception 'Configure the refund access policy'; end if;
  insert into public.payment_refunds(order_id,user_id,provider,refund_reference,amount,currency,access_policy) values(o.id,o.user_id,p_provider,p_refund_id,p_amount,p_currency,policy);
 end if;
 select coalesce(sum(amount),0) into total from public.payment_refunds where order_id=o.id;
 if total=o.amount then
  select access_policy into policy from public.payment_refunds where order_id=o.id order by created_at desc limit 1;
  update public.orders set status='REFUNDED',fulfillment_status='REFUNDED' where id=o.id;
  update public.payments set status='REFUNDED' where order_id=o.id;
  if policy='REVOKE_FULL' then
   update public.subscriptions s set status='PAUSED' where s.user_id=o.user_id and s.period_end in (select e.expires_at from public.entitlements e where e.order_id=o.id and e.kind='MEMBERSHIP');
   update public.entitlements set expires_at=now() where order_id=o.id;
   update public.review_credit_grants set quantity=consumed where order_id=o.id;
   update public.appointments set status='CANCELLED' where order_id=o.id and status='CONFIRMED';
  end if;
  perform public.enqueue_notification(o.user_id,'Refund confirmed','The payment provider confirmed your full refund. Your history remains available.','/account/purchases','refund.full:'||o.id);
 end if;
 return jsonb_build_object('status',case when total=o.amount then 'REFUNDED' else 'PARTIAL_REFUND' end,'refunded_amount',total,'order_id',o.id);
end; $$;
revoke all on function public.record_verified_refund(uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.record_verified_refund(uuid,text,text,bigint,text) to service_role;
create function public.record_paid_exception(p_order_id uuid,p_provider text,p_reference text,p_amount bigint,p_currency text,p_reason text) returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;
begin
 perform public.assert_service_role();
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.provider<>p_provider or o.reference<>p_reference or o.amount<>p_amount or o.currency<>p_currency then raise exception 'Verified payment exception does not match order'; end if;
 if o.status='REFUNDED' then raise exception 'Order already refunded'; end if;
 if o.status='SUCCESS' then return jsonb_build_object('status',case when o.fulfillment_status='REQUIRES_ACTION' then 'REQUIRES_ACTION' else 'SUCCESS' end,'order_id',o.id); end if;
 insert into public.payments(order_id,user_id,provider,reference,status,amount,currency,verified_at) values(o.id,o.user_id,p_provider,p_reference,'SUCCESS',o.amount,o.currency,now())
 on conflict(provider,reference) do update set status='SUCCESS',verified_at=now() where public.payments.order_id=excluded.order_id;
 update public.orders set status='SUCCESS',fulfillment_status='REQUIRES_ACTION',metadata=metadata||jsonb_build_object('fulfillment_issue',left(p_reason,300)) where id=o.id;
 insert into public.audit_logs(action,target,new_value) values('VERIFIED_PAYMENT_REQUIRES_ACTION','orders:'||o.id,jsonb_build_object('reason',left(p_reason,300),'no_entitlement_granted',true));
 perform public.enqueue_notification(o.user_id,'Payment verified — team action needed','Payment was verified, but access/booking could not be assigned automatically. The team must arrange support or resolve a refund.','/account/purchases','payment.exception:'||o.id);
 return jsonb_build_object('status','REQUIRES_ACTION','order_id',o.id);
end; $$;
revoke all on function public.record_paid_exception(uuid,text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.record_paid_exception(uuid,text,text,bigint,text,text) to service_role;
-- A refunded/paused period must not postpone a later paid renewal.
do $$ declare source text; begin
 source:=pg_get_functiondef('public.fulfill_order(uuid,text,text,bigint,text,text)'::regprocedure);
 if strpos(source,'where s.user_id=o.user_id;')>0 then execute replace(source,'where s.user_id=o.user_id;','where s.user_id=o.user_id and s.status in (''ACTIVE'',''EXPIRING'',''CANCELLED'');'); end if;
end $$;
commit;
