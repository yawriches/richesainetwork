-- Admin-only operations exposed through user-scoped authenticated Supabase clients.
begin;

create or replace function public.admin_review_feedback(
  p_submission_id uuid, p_overall_score numeric, p_category_scores jsonb,
  p_strengths text, p_improvements text, p_next_steps text
) returns uuid language plpgsql security definer set search_path = public as $$
declare submission public.review_submissions%rowtype; feedback_id uuid; entry record; score numeric; max_score numeric; overall_max numeric;
begin
  if not public.is_admin() then raise exception 'Administrator authorization required'; end if;
  if p_category_scores is null or jsonb_typeof(p_category_scores)<>'object' then raise exception 'Category scores must be a JSON object'; end if;
  select * into submission from public.review_submissions where id=p_submission_id for update;
  if not found then raise exception 'Review submission not found'; end if;
  select (value #>> '{}')::numeric into overall_max from public.business_settings where key='review.scoring_max' and active;
  if overall_max is null or overall_max<=0 then raise exception 'Overall review scoring maximum is not configured'; end if;
  if p_overall_score<0 or p_overall_score>overall_max then raise exception 'Overall score is outside the configured range'; end if;
  for entry in select key,value from jsonb_each(p_category_scores) loop
    if jsonb_typeof(entry.value)<>'number' then raise exception 'Each category score must be numeric'; end if;
    score := (entry.value #>> '{}')::numeric;
    select c.max_score into max_score from public.review_scoring_criteria c
      where c.category=submission.review_category and c.criterion_key=entry.key and c.active;
    if not found then raise exception 'Scoring criterion % is not configured for this review category',entry.key; end if;
    if score<0 or score>max_score then raise exception 'Score for % is outside the configured range',entry.key; end if;
  end loop;
  if submission.status='PENDING' then
    update public.review_submissions set status='UNDER_REVIEW',reviewer_id=auth.uid() where id=submission.id;
  elsif submission.status='UNDER_REVIEW' then
    update public.review_submissions set reviewer_id=auth.uid() where id=submission.id;
  elsif submission.status<>'REVIEWED' then
    raise exception 'Review cannot be published in its current state';
  end if;
  insert into public.review_feedback(submission_id,overall_score,category_scores,strengths,improvements,next_steps,reviewer_id)
  values(submission.id,p_overall_score,p_category_scores,coalesce(p_strengths,''),coalesce(p_improvements,''),coalesce(p_next_steps,''),auth.uid())
  on conflict(submission_id) do update set overall_score=excluded.overall_score,category_scores=excluded.category_scores,
    strengths=excluded.strengths,improvements=excluded.improvements,next_steps=excluded.next_steps,reviewer_id=excluded.reviewer_id
  returning id into feedback_id;
  if submission.status<>'REVIEWED' then
    update public.review_submissions set status='REVIEWED',completed_at=now(),reviewer_id=auth.uid() where id=submission.id;
  end if;
  insert into public.notifications(user_id,title,body,url,event_key)
    values(submission.user_id,'Your technical review is ready','Your reviewer has published feedback for “'||submission.title||'”.',
      '/student/reviews/'||submission.id,'review.feedback:'||submission.id)
    on conflict(user_id,event_key) do nothing;
  insert into public.notification_outbox(user_id,channel,status,payload,event_key,sent_at)
    values(submission.user_id,'IN_APP','SENT',jsonb_build_object('title','Your technical review is ready','submission_id',submission.id),
      'review.feedback:'||submission.id,now()) on conflict(channel,user_id,event_key) do nothing;
  return feedback_id;
end;
$$;

create or replace function public.admin_adjust_credit(p_user_id uuid,p_quantity integer,p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare remaining bigint; before_balance bigint; after_balance bigint; g public.review_credit_grants%rowtype; take integer;
begin
  if not public.is_admin() then raise exception 'Administrator authorization required'; end if;
  if p_user_id is null or p_quantity is null or p_quantity=0 or nullif(trim(p_reason),'') is null or char_length(p_reason)>500 then
    raise exception 'User, non-zero quantity, and a reason of at most 500 characters are required';
  end if;
  perform 1 from public.profiles where id=p_user_id for update;
  if not found then raise exception 'Profile not found'; end if;
  select coalesce(sum(quantity-used),0) into before_balance from public.review_credit_grants
    where user_id=p_user_id and used<quantity and (expires_at is null or expires_at>now());
  if p_quantity>0 then
    insert into public.review_credit_grants(user_id,source,quantity,reason) values(p_user_id,'ADMIN',p_quantity,trim(p_reason));
  else
    remaining := abs(p_quantity::bigint);
    for g in select * from public.review_credit_grants where user_id=p_user_id and used<quantity
      and (expires_at is null or expires_at>now()) order by expires_at nulls last,period_start nulls last,created_at for update loop
      take := least((g.quantity-g.used)::bigint,remaining)::integer;
      update public.review_credit_grants set used=used+take,
        reason=left(concat_ws(' | ',nullif(reason,''),'admin adjustment: '||trim(p_reason)),500) where id=g.id;
      remaining := remaining-take;
      exit when remaining<=0;
    end loop;
    if remaining>0 then raise exception 'Cannot remove more credits than the available balance'; end if;
  end if;
  select coalesce(sum(quantity-used),0) into after_balance from public.review_credit_grants
    where user_id=p_user_id and used<quantity and (expires_at is null or expires_at>now());
  insert into public.audit_logs(actor_id,action,target,old_value,new_value)
    values(auth.uid(),'ADMIN_CREDIT_ADJUSTMENT','review_credit_grants:user:'||p_user_id,
      jsonb_build_object('available',before_balance),jsonb_build_object('available',after_balance,'quantity_delta',p_quantity,'reason',trim(p_reason)));
  return jsonb_build_object('user_id',p_user_id,'quantity_delta',p_quantity,'available',after_balance);
end;
$$;

create or replace function public.admin_metrics(p_from timestamptz default null,p_to timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare from_at timestamptz:=coalesce(p_from,now()-interval '30 days'); to_at timestamptz:=coalesce(p_to,now()); overdue_before timestamptz; turnaround_hours integer;
begin
  if not public.is_admin() then raise exception 'Administrator authorization required'; end if;
  if from_at>=to_at then raise exception 'p_from must be earlier than p_to'; end if;
  select (value #>> '{}')::integer into turnaround_hours from public.business_settings where key='review.turnaround_hours' and active;
  if turnaround_hours is null or turnaround_hours<=0 then raise exception 'Review turnaround threshold is not configured'; end if;
  overdue_before := now()-make_interval(hours=>turnaround_hours);
  return jsonb_build_object(
    'period',jsonb_build_object('from',from_at,'to',to_at),
    'users_total',(select count(*) from public.profiles),
    'new_users',(select count(*) from public.profiles where created_at>=from_at and created_at<to_at),
    'active_users',(select count(*) from auth.users u where u.last_sign_in_at>=from_at and u.last_sign_in_at<to_at),
    'paying_users',(select count(distinct p.user_id) from public.payments p where p.status='SUCCESS' and p.verified_at>=from_at and p.verified_at<to_at),
    'active_members',(select count(distinct s.user_id) from public.subscriptions s where s.status in ('ACTIVE','EXPIRING','CANCELLED') and s.period_start<=now() and s.period_end>now()),
    'revenue_by_currency',(select coalesce(jsonb_agg(jsonb_build_object('currency',r.currency,'amount_minor',r.amount_minor) order by r.currency),'[]'::jsonb)
       from (select p.currency,sum(p.amount)::bigint amount_minor from public.payments p where p.status='SUCCESS' and p.verified_at>=from_at and p.verified_at<to_at group by p.currency) r),
    'revenue_by_product',(select coalesce(jsonb_agg(jsonb_build_object('product_id',r.product_id,'product_name',r.product_name,'currency',r.currency,'amount_minor',r.amount_minor) order by r.product_name,r.currency),'[]'::jsonb)
       from (select o.product_id,pr.name product_name,p.currency,sum(p.amount)::bigint amount_minor from public.payments p join public.orders o on o.id=p.order_id
         join public.products pr on pr.id=o.product_id where p.status='SUCCESS' and p.verified_at>=from_at and p.verified_at<to_at group by o.product_id,pr.name,p.currency) r),
    'popular_courses',(select coalesce(jsonb_agg(jsonb_build_object('course_id',r.course_id,'title',r.title,'enrollments',r.enrollments) order by r.enrollments desc,r.title),'[]'::jsonb)
       from (select c.id course_id,c.title,count(e.id)::bigint enrollments from public.courses c left join public.enrollments e on e.course_id=c.id and e.enrolled_at>=from_at and e.enrolled_at<to_at
         where c.status='PUBLISHED' group by c.id,c.title order by count(e.id) desc,c.title limit 10) r),
    'pending_reviews',(select count(*) from public.review_submissions where status in ('PENDING','UNDER_REVIEW')),
    'overdue_reviews',(select count(*) from public.review_submissions where status in ('PENDING','UNDER_REVIEW') and created_at<=overdue_before),
    'upcoming_appointments',(select count(*) from public.appointments where status='CONFIRMED' and starts_at>=now() and starts_at>=from_at and starts_at<to_at)
  );
end;
$$;



create or replace function public.admin_version_price(p_price_id uuid,p_values jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare old_price public.product_prices%rowtype; new_id uuid; new_interval text; new_interval_count integer; new_months integer;
        new_amount integer; new_currency text; new_country text; new_status text; new_starts timestamptz; new_ends timestamptz; new_sort integer;
begin
  if not public.is_admin() then raise exception 'Administrator authorization required'; end if;
  if p_values is null or jsonb_typeof(p_values)<>'object' then raise exception 'Price values must be a JSON object'; end if;
  if (p_values - array['product_id','amount','currency','country_code','billing_interval','billing_interval_count','status','starts_at','ends_at','sort_order']) <> '{}'::jsonb then
    raise exception 'Unsupported price field in p_values';
  end if;
  select * into old_price from public.product_prices where id=p_price_id for update;
  if not found then raise exception 'Price not found'; end if;
  if p_values ? 'product_id' and (p_values->>'product_id')::uuid is distinct from old_price.product_id then
    raise exception 'A price version cannot be rebound to a different product';
  end if;
  new_amount:=coalesce((p_values->>'amount')::integer,old_price.amount);
  new_currency:=coalesce(nullif(p_values->>'currency',''),old_price.currency);
  new_country:=case when p_values ? 'country_code' then p_values->>'country_code' else old_price.country_code end;
  new_interval:=coalesce(nullif(p_values->>'billing_interval',''),old_price.billing_interval);
  new_interval_count:=coalesce((p_values->>'billing_interval_count')::integer,old_price.billing_interval_count);
  new_status:=coalesce(nullif(p_values->>'status',''),old_price.status);
  new_starts:=case when p_values ? 'starts_at' then (p_values->>'starts_at')::timestamptz else old_price.starts_at end;
  new_ends:=case when p_values ? 'ends_at' then (p_values->>'ends_at')::timestamptz else old_price.ends_at end;
  new_sort:=coalesce((p_values->>'sort_order')::integer,old_price.sort_order);
  if new_interval_count<=0 then raise exception 'Billing interval count must be positive'; end if;
  if new_interval='MONTH' then new_months:=new_interval_count;
  elsif new_interval='YEAR' then new_months:=new_interval_count*12;
  elsif new_interval='ONCE' then new_months:=0;
  else raise exception 'Unsupported billing interval'; end if;

  update public.product_prices set status='PAUSED' where id=old_price.id;
  insert into public.product_prices(product_id,amount,currency,country_code,billing_interval,billing_interval_count,status,starts_at,ends_at,sort_order)
  values(old_price.product_id,new_amount,new_currency,new_country,new_interval,new_interval_count,new_status,new_starts,new_ends,new_sort)
  returning id into new_id;
  update public.membership_plans set price_id=new_id,billing_months=new_months where price_id=old_price.id;
  update public.support_packages set price_id=new_id where price_id=old_price.id;
  insert into public.audit_logs(actor_id,action,target,old_value,new_value)
  values(auth.uid(),'ADMIN_PRICE_VERSION','product_prices:'||old_price.id,
    to_jsonb(old_price),jsonb_build_object('new_price_id',new_id,'values',p_values));
  return new_id;
end;
$$;

revoke all on function public.admin_review_feedback(uuid,numeric,jsonb,text,text,text) from public,anon,authenticated;
revoke all on function public.admin_adjust_credit(uuid,integer,text) from public,anon,authenticated;
revoke all on function public.admin_metrics(timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.admin_version_price(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_review_feedback(uuid,numeric,jsonb,text,text,text) to authenticated;
grant execute on function public.admin_adjust_credit(uuid,integer,text) to authenticated;
grant execute on function public.admin_metrics(timestamptz,timestamptz) to authenticated;
grant execute on function public.admin_version_price(uuid,jsonb) to authenticated;

-- No authenticated role (including admins) can inspect validation markers; trusted
-- service_role writes them after ffprobe + private Storage upload.
revoke all on table public.validated_uploads from anon,authenticated;

commit;
