begin;
create function public.check_purchase_publication() returns trigger language plpgsql set search_path=public as $$
begin
 if new.status='PUBLISHED' and new.access_type='PURCHASE' then
  if new.product_id is null or not exists(select 1 from public.products where id=new.product_id and type='COURSE' and status='ACTIVE') then raise exception 'A published purchase course needs an active COURSE product'; end if;
  if not exists(select 1 from public.product_prices where product_id=new.product_id and status='ACTIVE' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now())) then raise exception 'Configure an active course price before publishing a purchase course'; end if;
 end if; return new;
end; $$;
create trigger course_purchase_publication before insert or update on public.courses for each row execute function public.check_purchase_publication();
revoke all on function public.check_purchase_publication() from public,anon,authenticated;

-- The snapshot and stable plan FK survive later price-version and benefit edits.
create function public.freeze_order_terms() returns trigger language plpgsql set search_path=public as $$
begin
 if new.membership_plan_id is null and new.snapshot->'plan'->>'id' is not null then new.membership_plan_id:=(new.snapshot->'plan'->>'id')::uuid; end if;
 if new.snapshot->'product'->>'review_credit_quantity' is null then new.snapshot:=jsonb_set(new.snapshot,'{product,review_credit_quantity}',to_jsonb((select review_credit_quantity from public.products where id=new.product_id))); end if;
 return new;
end; $$;
create trigger order_freeze_terms before insert on public.orders for each row execute function public.freeze_order_terms();
revoke all on function public.freeze_order_terms() from public,anon,authenticated;
update public.orders set membership_plan_id=(snapshot->'plan'->>'id')::uuid where membership_plan_id is null and snapshot->'plan'->>'id' is not null;
create function public.apply_purchased_credit_snapshot() returns trigger language plpgsql set search_path=public as $$
declare q integer;
begin
 if new.source='PURCHASE' and new.order_id is not null then
  select (o.snapshot->'product'->>'review_credit_quantity')::integer into q from public.orders o join public.products p on p.id=o.product_id where o.id=new.order_id and p.type='REVIEW';
  if q is not null then if q<1 then raise exception 'Invalid purchased-credit snapshot'; end if; new.quantity:=q; end if;
 end if; return new;
end; $$;
create trigger review_purchase_snapshot before insert on public.review_credit_grants for each row execute function public.apply_purchased_credit_snapshot();
revoke all on function public.apply_purchased_credit_snapshot() from public,anon,authenticated;

create function public.admin_grant_course(p_user_id uuid,p_course_id uuid,p_reason text,p_expires_at timestamptz default null) returns uuid language plpgsql security definer set search_path=public as $$
declare c public.courses%rowtype; eid uuid;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Explain the manual access grant'; end if;
 if p_expires_at is not null and p_expires_at<=now() then raise exception 'Access expiry must be in the future'; end if;
 select * into c from public.courses where id=p_course_id and access_type='PURCHASE' and status='PUBLISHED';
 if not found or c.product_id is null then raise exception 'Select a published purchase course with a product'; end if;
 perform 1 from public.profiles where id=p_user_id and status='ACTIVE' for update;
 if not found then raise exception 'Select an active learner'; end if;
 select id into eid from public.entitlements where user_id=p_user_id and product_id=c.product_id and kind='ADMIN' and (expires_at is null or expires_at>now()) limit 1;
 if eid is null then insert into public.entitlements(user_id,product_id,kind,expires_at) values(p_user_id,c.product_id,'ADMIN',p_expires_at) returning id into eid; end if;
 insert into public.enrollments(user_id,course_id) values(p_user_id,c.id) on conflict(user_id,course_id) do nothing;
 insert into public.audit_logs(actor_id,action,target,new_value) values(auth.uid(),'MANUAL_COURSE_GRANT','entitlements:'||eid,jsonb_build_object('user_id',p_user_id,'course_id',c.id,'reason',p_reason,'expires_at',p_expires_at,'payment_created',false));
 perform public.enqueue_notification(p_user_id,'Course access granted','An administrator granted course access. No payment was recorded.','/learn/'||c.id,'manual_access:'||eid);
 return eid;
end; $$;
revoke all on function public.admin_grant_course(uuid,uuid,text,timestamptz) from public,anon;
grant execute on function public.admin_grant_course(uuid,uuid,text,timestamptz) to authenticated,service_role;

create function private.award_activity(p_user uuid,p_event text,p_event_id text) returns void language plpgsql security definer set search_path=public,private as $$
declare rule public.points_rules%rowtype; config jsonb; item jsonb; threshold bigint; achieved bigint; badge uuid;
begin
 select * into rule from public.points_rules where event_key=p_event and active;
 if found and rule.points>0 then insert into public.points_transactions(user_id,rule_id,event_key,event_id,points) values(p_user,rule.id,p_event,p_event_id,rule.points) on conflict(user_id,event_key,event_id) do nothing; end if;
 select value into config from public.business_settings where key='gamification.badge_rules' and active;
 if jsonb_typeof(config)='array' then
  for item in select value from jsonb_array_elements(config) loop
   if coalesce(item->>'threshold','') !~ '^[0-9]{1,9}$' then continue; end if;
   threshold:=(item->>'threshold')::bigint; if threshold<1 then continue; end if;
   case item->>'activity'
    when 'POINTS_TOTAL' then select coalesce(sum(points),0) into achieved from public.points_transactions where user_id=p_user;
    when 'LESSONS_COMPLETED' then select count(*) into achieved from public.lesson_progress where user_id=p_user;
    when 'REVIEWS_COMPLETED' then select count(*) into achieved from public.review_submissions where user_id=p_user and status='REVIEWED';
    else continue;
   end case;
   select id into badge from public.badges where key=item->>'badge_key' and active;
   if badge is not null and achieved>=threshold then insert into public.user_badges(user_id,badge_id,award_event_key) values(p_user,badge,p_event||':'||p_event_id) on conflict(user_id,badge_id) do nothing; end if;
  end loop;
 end if;
end; $$;
revoke all on function private.award_activity(uuid,text,text) from public,anon,authenticated;
create function public.award_completion_activity() returns trigger language plpgsql security definer set search_path=public,private as $$
begin
 if tg_table_name='lesson_progress' then perform private.award_activity(new.user_id,'lesson_completed',new.lesson_id::text);
 elsif new.status='REVIEWED' and old.status is distinct from new.status then perform private.award_activity(new.user_id,'review_completed',new.id::text); end if;
 return new;
end; $$;
revoke all on function public.award_completion_activity() from public,anon,authenticated;
create trigger lesson_recognition after insert on public.lesson_progress for each row execute function public.award_completion_activity();
create trigger review_recognition after update on public.review_submissions for each row execute function public.award_completion_activity();
create function public.my_recognition() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and status='ACTIVE') then raise exception 'Sign in to read recognition'; end if;
 return jsonb_build_object('points',coalesce((select sum(points) from public.points_transactions where user_id=auth.uid()),0),'badges',coalesce((select jsonb_agg(t) from (select b.id,b.name,b.description,b.icon_url,u.awarded_at from public.user_badges u join public.badges b on b.id=u.badge_id where u.user_id=auth.uid() order by u.awarded_at desc limit 200) t),'[]'::jsonb));
end; $$;
revoke all on function public.my_recognition() from public,anon;
grant execute on function public.my_recognition() to authenticated,service_role;
commit;
