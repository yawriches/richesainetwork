-- Seed only the explicitly specified business values. No courses, testimonials, meetings,
-- payment-provider country mappings, WhatsApp URLs, or credentials are fabricated.
begin;

insert into public.currencies(code,name,minor_units) values
 ('GHS','Ghanaian cedi',2),('NGN','Nigerian naira',2),('KES','Kenyan shilling',2),('ZAR','South African rand',2)
on conflict(code) do update set name=excluded.name,minor_units=excluded.minor_units;

insert into public.countries(code,name,currency_code,active) values
 ('GH','Ghana','GHS',true),('NG','Nigeria','NGN',true),('KE','Kenya','KES',true),('ZA','South Africa','ZAR',true)
on conflict(code) do update set name=excluded.name,currency_code=excluded.currency_code,active=excluded.active;

insert into public.business_settings(key,value,type,category,description,active,is_public,unit,min_value,max_value,allowed_values) values
 ('review.free_monthly_quantity','1'::jsonb,'NUMBER','reviews','Free review credits per UTC calendar month when no membership is active.',true,true,'credits',0,100,null),
 ('review.video_max_duration_seconds','90'::jsonb,'DURATION','reviews','Maximum actual server-probed review video duration.',true,true,'seconds',1,3600,null),
 ('review.video_max_size_bytes','52428800'::jsonb,'NUMBER','reviews','Maximum validated review upload size; bucket cap follows this editable value.',true,true,'bytes',1,null,null),
 ('review.turnaround_hours','72'::jsonb,'DURATION','reviews','Target review turnaround, not a guaranteed service-level agreement.',true,true,'hours',1,720,null),
 ('review.video_retention_days','30'::jsonb,'DURATION','reviews','Days after review completion before raw video cleanup.',true,false,'days',0,3650,null),
 ('review.allowed_mime_types','["video/mp4","video/webm","video/quicktime"]'::jsonb,'JSON','reviews','Allowed detected MIME types; direct browser claims are not trusted.',true,true,null,null,null,null),
 ('review.validation_record_ttl_minutes','120'::jsonb,'DURATION','reviews','Trusted media validation record lifetime before submission.',true,false,'minutes',1,1440,null),
 ('booking.hold_lifetime_minutes','15'::jsonb,'DURATION','booking','Capacity hold duration during checkout.',true,true,'minutes',1,120,null),
 ('booking.cancellation_notice_hours','24'::jsonb,'DURATION','booking','Editable cancellation notice period.',true,false,'hours',0,720,null),
 ('membership.expiring_within_days','7'::jsonb,'DURATION','membership','How early an active subscription is marked EXPIRING by jobs.',true,false,'days',0,90,null),
 ('notification.reminder_offsets_hours','[24,1]'::jsonb,'JSON','notifications','Appointment reminder offsets, hours before start; delivery needs a configured sender.',true,false,null,null,null,null),
 ('storage.signed_url_ttl_seconds','300'::jsonb,'DURATION','storage','Default short-lived private-file signed URL lifetime.',true,false,'seconds',30,3600,null),
 ('booking.timezone_display','"UTC"'::jsonb,'STRING','booking','Database stores UTC instants; application localizes for the learner.',true,false,null,null,null,null),
 ('review.scoring_max','100'::jsonb,'NUMBER','reviews','Maximum overall review score on a 100-point scale.',true,false,'points',1,100,null)
on conflict(key) do update set value=excluded.value,type=excluded.type,category=excluded.category,description=excluded.description,
 active=excluded.active,is_public=excluded.is_public,unit=excluded.unit,min_value=excluded.min_value,max_value=excluded.max_value,allowed_values=excluded.allowed_values;

insert into public.payment_providers(code,name,enabled,countries,currencies,methods,recurring_enabled,mode,capabilities) values
 ('PAYSTACK','Paystack',false,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,false,'TEST','{}'::jsonb),
 ('KORA','Kora',false,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,false,'TEST','{}'::jsonb)
on conflict(code) do update set name=excluded.name,enabled=false,countries='[]'::jsonb,currencies='[]'::jsonb,methods='[]'::jsonb,recurring_enabled=false,mode='TEST';

-- Stable IDs make this seed repeatable and make parent/API fixtures easy to reference.
insert into public.products(id,name,type,status,review_credit_quantity) values
 ('10000000-0000-4000-8000-000000000001','Community Membership','MEMBERSHIP','ACTIVE',1),
 ('10000000-0000-4000-8000-000000000002','Additional Technical Review','REVIEW','ACTIVE',1),
 ('10000000-0000-4000-8000-000000000003','1-on-1 Support','SUPPORT','ACTIVE',1)
on conflict(id) do update set name=excluded.name,type=excluded.type,status=excluded.status,review_credit_quantity=excluded.review_credit_quantity;

insert into public.product_prices(id,product_id,amount,currency,country_code,billing_interval,billing_interval_count,status,sort_order) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',7500,'GHS','GH','MONTH',1,'ACTIVE',10),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',20000,'GHS','GH','MONTH',3,'PAUSED',20),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',70000,'GHS','GH','YEAR',1,'PAUSED',30),
 ('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002',2000,'GHS','GH','ONCE',1,'ACTIVE',10),
 ('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000003',10000,'GHS','GH','ONCE',1,'ACTIVE',10)
on conflict(id) do update set product_id=excluded.product_id,amount=excluded.amount,currency=excluded.currency,country_code=excluded.country_code,
 billing_interval=excluded.billing_interval,billing_interval_count=excluded.billing_interval_count,status=excluded.status,sort_order=excluded.sort_order;

insert into public.membership_plans(id,name,description,product_id,price_id,included_reviews,billing_months,status,benefits,countries,providers) values
 ('30000000-0000-4000-8000-000000000001','Community Monthly','Monthly access to member learning, practical feedback, and the creative community.','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',2,1,'ACTIVE',
  '["Member-only learning and community access","Community events and AI resources"]'::jsonb,'["GH"]'::jsonb,'[]'::jsonb),
 ('30000000-0000-4000-8000-000000000002','Community Quarterly','Inactive example price; availability requires explicit admin activation.','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',2,3,'INACTIVE',
  '["Member-only learning and community access","Community events and AI resources"]'::jsonb,'["GH"]'::jsonb,'[]'::jsonb),
 ('30000000-0000-4000-8000-000000000003','Community Annual','Inactive example price; availability requires explicit admin activation.','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003',2,12,'INACTIVE',
  '["Member-only learning and community access","Community events and AI resources"]'::jsonb,'["GH"]'::jsonb,'[]'::jsonb)
on conflict(id) do update set name=excluded.name,description=excluded.description,product_id=excluded.product_id,price_id=excluded.price_id,
 included_reviews=excluded.included_reviews,billing_months=excluded.billing_months,status=excluded.status,benefits=excluded.benefits,countries=excluded.countries,providers=excluded.providers;

insert into public.support_packages(id,name,description,product_id,price_id,duration_minutes,status) values
 ('40000000-0000-4000-8000-000000000001','1-on-1 Support — 30 minutes','Thirty-minute individual support session. Availability and meeting details are configured by an administrator.',
  '10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000005',30,'ACTIVE')
on conflict(id) do update set name=excluded.name,description=excluded.description,product_id=excluded.product_id,price_id=excluded.price_id,duration_minutes=excluded.duration_minutes,status=excluded.status;

insert into public.project_categories(category,label,sort_order,active) values
 ('AI_VIDEO','AI Video',10,true),('AI_GRAPHICS','AI Graphics',20,true),('PHOTOGRAPHY','Photography',30,true),
 ('AUTOMATION','Automation',40,true),('CONTENT_CREATION','Content Creation',50,true),('OTHER','Other',100,true)
on conflict(category) do update set label=excluded.label,sort_order=excluded.sort_order,active=excluded.active;
update public.project_categories set active=false where category not in ('AI_VIDEO','AI_GRAPHICS','PHOTOGRAPHY','AUTOMATION','CONTENT_CREATION','OTHER');

insert into public.review_categories(category,label,sort_order,active) values
 ('GENERAL','General technical review',10,true)
on conflict(category) do update set label=excluded.label,sort_order=excluded.sort_order,active=excluded.active;
update public.review_categories set active=false where category<>'GENERAL';

insert into public.review_scoring_criteria(category,criterion_key,label,description,max_score,sort_order,active)
select 'GENERAL',v.criterion_key,v.label,v.description,100,v.sort_order,true
from (values
 ('VISUAL_QUALITY','Visual Quality','Composition, clarity, and visual craft.',10),
 ('AI_GENERATION','AI Generation','Prompting, generation quality, and responsible use of AI tools.',20),
 ('STORYTELLING','Storytelling','Narrative clarity, structure, and audience fit.',30),
 ('EDITING','Editing','Pacing, sequencing, and refinement.',40),
 ('AUDIO','Audio','Voice, music, sound design, and intelligibility.',50),
 ('ADVERTISING_EFFECTIVENESS','Advertising Effectiveness','Message, audience relevance, and call-to-action effectiveness.',60),
 ('OVERALL','Overall','Holistic assessment of the submitted work.',70)
) as v(criterion_key,label,description,sort_order)
on conflict(category,criterion_key) do update set label=excluded.label,description=excluded.description,max_score=excluded.max_score,sort_order=excluded.sort_order,active=true;
update public.review_scoring_criteria set active=false where category<>'GENERAL';

insert into public.points_rules(event_key,name,points,active) values
 ('lesson_completed','Lesson completed',1,true),('review_completed','Technical review completed',1,true)
on conflict(event_key) do update set name=excluded.name,points=excluded.points,active=excluded.active;

commit;
