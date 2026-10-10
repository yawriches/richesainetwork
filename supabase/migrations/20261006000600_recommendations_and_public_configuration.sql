begin;
create or replace function public.validate_business_setting()
returns trigger language plpgsql set search_path = public as $$
declare jtype text := jsonb_typeof(new.value); n numeric;
begin
  if new.type in ('NUMBER','DURATION','PERCENTAGE') then
    if jtype <> 'number' then raise exception 'Setting % must be a JSON number', new.key; end if;
    n := (new.value #>> '{}')::numeric;
    if new.min_value is not null and n < new.min_value then raise exception 'Setting % is below its minimum', new.key; end if;
    if new.max_value is not null and n > new.max_value then raise exception 'Setting % is above its maximum', new.key; end if;
    if new.type = 'PERCENTAGE' and (n < 0 or n > 100) then raise exception 'Setting % must be between 0 and 100', new.key; end if;
  elsif new.type = 'BOOLEAN' and jtype <> 'boolean' then raise exception 'Setting % must be a JSON boolean', new.key;
  elsif new.type in ('STRING','CURRENCY','URL') and jtype <> 'string' then raise exception 'Setting % must be a JSON string', new.key;
  elsif new.type = 'JSON' and jtype not in ('object','array','string','number','boolean','null') then raise exception 'Setting % must be valid JSON', new.key;
  end if;
  if new.type='CURRENCY' and (new.value #>> '{}') !~ '^[A-Z]{3}$' then raise exception 'Setting % must be an ISO currency code',new.key; end if;
  if new.type='URL' and not (not new.active and (new.value #>> '{}')='') and (new.value #>> '{}') !~ '^https?://' then raise exception 'Setting % must be an http(s) URL',new.key; end if;
  if new.key='review.allowed_mime_types' and (jtype<>'array' or jsonb_array_length(new.value)=0 or exists(select 1 from jsonb_array_elements(new.value) x where jsonb_typeof(x.value)<>'string' or (x.value #>> '{}') !~ '^[a-z0-9.+-]+/[a-z0-9.+*-]+$')) then raise exception 'Review allowed MIME types must be a non-empty array of MIME type strings'; end if;
  if new.allowed_values is not null and not (new.allowed_values @> jsonb_build_array(new.value)) then raise exception 'Setting % is not an allowed value',new.key; end if;
  new.updated_at := now(); return new;
end; $$;
insert into public.business_settings(key,value,type,category,description,active,is_public) values
('learning.recommendation_mappings','[]'::jsonb,'JSON','learning','Optional ordered objects {interest,experience_level,course_id}; only matching published free courses are recommended.',true,false),
('gamification.badge_rules','[]'::jsonb,'JSON','gamification','Objects {badge_key,activity,threshold}. Activity POINTS_TOTAL, LESSONS_COMPLETED, or REVIEWS_COMPLETED; threshold positive integer.',true,false),
('contact.email','""'::jsonb,'STRING','public','Public support email. Leave empty until an actual address is approved.',true,true),
('community.whatsapp_url','""'::jsonb,'URL','community','Private invitation. Enter a real link and activate it; copied invitations cannot be revoked by RLS.',false,false),
('home.hero_title','"Turn curiosity into your next chapter."'::jsonb,'STRING','public','Public homepage hero heading.',true,true),
('home.hero_description','"Learn practical AI skills. Make something of your own. Get feedback from people who want you to grow."'::jsonb,'STRING','public','Public homepage hero description.',true,true),
('public.testimonials','[]'::jsonb,'JSON','public','Approved genuine testimonials only: {quote,name,role}. No invented ratings or income results.',true,true)
on conflict(key) do nothing;
alter table public.business_settings add constraint private_whatsapp_setting check(key<>'community.whatsapp_url' or (not is_public and category<>'public'));
commit;
