-- AI Riches Network V1 database foundation.
-- This migration is local source only; it has NOT been applied to any Supabase project.

begin;

create table public.currencies (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  name text not null,
  minor_units smallint not null check (minor_units between 0 and 4),
  created_at timestamptz not null default now()
);

create table public.countries (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null,
  currency_code text not null references public.currencies(code),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 160),
  email text not null default '' check (char_length(email) <= 320),
  country_code text references public.countries(code),
  interests jsonb not null default '[]'::jsonb check (jsonb_typeof(interests) = 'array'),
  experience_level text check (experience_level is null or experience_level in ('BEGINNER','INTERMEDIATE','ADVANCED')),
  onboarded boolean not null default false,
  role text not null default 'STUDENT' check (role in ('STUDENT','ADMIN')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.-]{1,119}$'),
  value jsonb not null,
  type text not null check (type in ('NUMBER','BOOLEAN','STRING','JSON','DURATION','CURRENCY','PERCENTAGE','URL')),
  category text not null,
  description text not null default '',
  active boolean not null default true,
  is_public boolean not null default false,
  unit text,
  min_value numeric,
  max_value numeric,
  allowed_values jsonb,
  updated_at timestamptz not null default now(),
  check (min_value is null or max_value is null or min_value <= max_value),
  check (allowed_values is null or jsonb_typeof(allowed_values) = 'array')
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('COURSE','MEMBERSHIP','REVIEW','SUPPORT')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','ARCHIVED')),
  review_credit_quantity integer not null default 1 check (review_credit_quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  amount integer not null check (amount >= 0),
  currency text not null references public.currencies(code),
  country_code text references public.countries(code),
  billing_interval text not null check (billing_interval in ('MONTH','ONCE','YEAR')),
  billing_interval_count integer not null default 1 check (billing_interval_count > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','ARCHIVED')),
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or starts_at < ends_at)
);

create table public.payment_providers (
  code text primary key check (code in ('PAYSTACK','KORA')),
  name text not null,
  enabled boolean not null default false,
  countries jsonb not null default '[]'::jsonb check (jsonb_typeof(countries)='array'),
  currencies jsonb not null default '[]'::jsonb check (jsonb_typeof(currencies)='array'),
  methods jsonb not null default '[]'::jsonb check (jsonb_typeof(methods)='array'),
  recurring_enabled boolean not null default false,
  mode text not null default 'TEST' check (mode in ('TEST','LIVE')),
  capabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(capabilities) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_provider_countries (
  provider text not null references public.payment_providers(code) on delete cascade,
  country_code text not null references public.countries(code),
  currency_code text not null references public.currencies(code),
  enabled boolean not null default false,
  verified_at timestamptz,
  primary key (provider, country_code, currency_code)
);

create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  product_id uuid not null references public.products(id) on delete restrict,
  price_id uuid not null references public.product_prices(id) on delete restrict,
  included_reviews integer not null default 0 check (included_reviews >= 0),
  billing_months integer not null check (billing_months > 0),
  status text not null default 'INACTIVE' check (status in ('ACTIVE','INACTIVE','PAUSED','ARCHIVED')),
  benefits jsonb not null default '[]'::jsonb check (jsonb_typeof(benefits) in ('array','object')),
  countries jsonb not null default '[]'::jsonb check (jsonb_typeof(countries) = 'array'),
  providers jsonb not null default '[]'::jsonb check (jsonb_typeof(providers) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '',
  thumbnail_url text,
  instructor text not null default '',
  category text not null default '',
  level text not null default 'BEGINNER' check (level in ('BEGINNER','INTERMEDIATE','ADVANCED')),
  access_type text not null default 'FREE' check (access_type in ('FREE','PURCHASE','MEMBERSHIP')),
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','ARCHIVED')),
  featured boolean not null default false,
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  objectives jsonb not null default '[]'::jsonb check (jsonb_typeof(objectives) = 'array'),
  prerequisites text not null default '',
  product_id uuid unique references public.products(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (course_id, sort_order)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  title text not null,
  body text not null default '',
  video_url text,
  resources jsonb not null default '[]'::jsonb check (jsonb_typeof(resources) = 'array'),
  exercise text not null default '',
  prompt text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (module_id, sort_order)
);

create table public.course_resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  title text not null,
  resource_type text not null check (resource_type in ('FILE','IMAGE','LINK','VIDEO')),
  storage_path text,
  external_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check ((storage_path is not null) or (external_url is not null))
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  current_lesson_id uuid references public.lessons(id) on delete set null,
  completed_at timestamptz,
  enrolled_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table public.lesson_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  price_id uuid not null references public.product_prices(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  membership_plan_id uuid references public.membership_plans(id) on delete restrict,
  amount integer not null check (amount >= 0),
  currency text not null references public.currencies(code),
  provider text not null references public.payment_providers(code),
  reference text,
  status text not null default 'PENDING' check (status in ('PENDING','SUCCESS','FAILED','CANCELLED','REFUNDED')),
  country_code text references public.countries(code),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  plan_id uuid not null references public.membership_plans(id) on delete restrict,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','EXPIRING','EXPIRED','CANCELLED','PAUSED')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  terms_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(terms_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_start < period_end)
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  expires_at timestamptz,
  kind text not null check (kind in ('PURCHASE','MEMBERSHIP','ADMIN')),
  created_at timestamptz not null default now(),
  unique (user_id, product_id, order_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null references public.payment_providers(code),
  reference text not null,
  status text not null check (status in ('PENDING','SUCCESS','FAILED','CANCELLED','REFUNDED')),
  amount integer not null check (amount >= 0),
  currency text not null references public.currencies(code),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, reference)
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null references public.payment_providers(code),
  event_key text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  unique (provider, event_key)
);

create table public.project_categories (
  category text primary key,
  label text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.review_categories (
  category text primary key,
  label text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.review_scoring_criteria (
  id uuid primary key default gen_random_uuid(),
  category text not null references public.review_categories(category) on update cascade on delete restrict,
  criterion_key text not null,
  label text not null,
  description text not null default '',
  max_score numeric(5,2) not null default 5 check (max_score > 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  unique (category, criterion_key)
);

create table public.review_credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  source text not null check (source in ('FREE','MEMBERSHIP','PURCHASE','ADMIN')),
  quantity integer not null check (quantity > 0),
  used integer not null default 0 check (used >= 0 and used <= quantity),
  period_start timestamptz,
  expires_at timestamptz,
  order_id uuid references public.orders(id) on delete restrict,
  reason text not null default '' check (char_length(reason)<=500),
  created_at timestamptz not null default now(),
  check (expires_at is null or period_start is null or period_start < expires_at)
);

create table public.validated_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_path text not null unique,
  video_size bigint not null check (video_size > 0),
  video_duration numeric(10,3) not null check (video_duration > 0),
  mime_type text not null,
  validated_at timestamptz not null default now(),
  consumed boolean not null default false,
  check (video_path like user_id::text || '/%')
);

create table public.review_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 180),
  project_category text not null references public.project_categories(category),
  review_category text not null references public.review_categories(category),
  description text not null default '' check (char_length(description) <= 10000),
  question text not null default '' check (char_length(question) <= 5000),
  video_path text,
  video_size bigint check (video_size is null or video_size > 0),
  video_duration numeric(10,3) check (video_duration is null or video_duration > 0),
  mime_type text,
  status text not null default 'PENDING' check (status in ('PENDING','UNDER_REVIEW','REVIEWED')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  video_deleted_at timestamptz,
  check ((video_path is null) or (video_size is not null and video_duration is not null and mime_type is not null))
);

create table public.review_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.review_submissions(id) on delete restrict,
  overall_score numeric(5,2) not null check (overall_score >= 0),
  category_scores jsonb not null default '{}'::jsonb check (jsonb_typeof(category_scores) = 'object'),
  strengths text not null default '',
  improvements text not null default '',
  next_steps text not null default '',
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  product_id uuid not null references public.products(id) on delete restrict,
  price_id uuid not null references public.product_prices(id) on delete restrict,
  duration_minutes integer not null check (duration_minutes > 0),
  status text not null default 'INACTIVE' check (status in ('ACTIVE','INACTIVE','PAUSED','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.availability (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.support_packages(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null default 1 check (capacity > 0),
  meeting_url text,
  status text not null default 'OPEN' check (status in ('OPEN','BLOCKED','CLOSED')),
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create table public.booking_holds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  availability_id uuid not null references public.availability(id) on delete restrict,
  expires_at timestamptz not null,
  order_id uuid unique,
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  availability_id uuid not null references public.availability(id) on delete restrict,
  package_id uuid not null references public.support_packages(id) on delete restrict,
  order_id uuid unique references public.orders(id) on delete restrict,
  status text not null default 'CONFIRMED' check (status in ('CONFIRMED','COMPLETED','CANCELLED','NO_SHOW')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  meeting_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create unique index appointments_user_slot_unique on public.appointments(user_id, availability_id)
  where status in ('CONFIRMED','COMPLETED');

create table public.ai_drops (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  type text not null check (type in ('PROMPT','TOOL','TUTORIAL','TEMPLATE','RESOURCE','WORKFLOW','NEWS')),
  url text,
  thumbnail_url text,
  audience text not null default 'PUBLIC' check (audience in ('PUBLIC','MEMBERS')),
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','CANCELLED')),
  publish_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  audience text not null default 'PUBLIC' check (audience in ('PUBLIC','MEMBERS')),
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','CANCELLED')),
  publish_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  url text,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or starts_at < ends_at)
);

create table public.event_private_links (
  event_id uuid primary key references public.events(id) on delete cascade,
  meeting_url text not null,
  updated_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  audience text not null default 'PUBLIC' check (audience in ('PUBLIC','MEMBERS')),
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','CANCELLED')),
  publish_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  url text,
  read_at timestamptz,
  event_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_key)
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('IN_APP','EMAIL')),
  status text not null default 'PENDING' check (status in ('PENDING','PROCESSING','SENT','FAILED','SKIPPED')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  event_key text not null,
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (channel, user_id, event_key)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create table public.points_rules (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  name text not null,
  points integer not null check (points >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.points_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  rule_id uuid references public.points_rules(id) on delete set null,
  event_key text not null,
  event_id text not null,
  points integer not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id, event_key, event_id)
);

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null default '',
  icon_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete restrict,
  awarded_at timestamptz not null default now(),
  award_event_key text,
  primary key (user_id, badge_id)
);

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null check (status in ('RUNNING','SUCCEEDED','PARTIAL','FAILED')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index product_prices_lookup_idx on public.product_prices(product_id, status, currency, country_code, starts_at, ends_at);
create index courses_catalog_idx on public.courses(status, featured desc, category, level, created_at desc);
create index course_modules_order_idx on public.course_modules(course_id, sort_order);
create index lessons_order_idx on public.lessons(module_id, sort_order);
create index enrollments_user_idx on public.enrollments(user_id, enrolled_at desc);
create index lesson_progress_user_idx on public.lesson_progress(user_id, completed_at desc);
create index orders_user_idx on public.orders(user_id, created_at desc);
create index subscriptions_user_period_idx on public.subscriptions(user_id, status, period_end desc);
create index entitlements_user_product_idx on public.entitlements(user_id, product_id, expires_at);
create index review_grants_balance_idx on public.review_credit_grants(user_id, expires_at, period_start);
create unique index review_free_month_user_unique on public.review_credit_grants(user_id, period_start) where source='FREE';
create index review_submissions_queue_idx on public.review_submissions(status, created_at);
create index availability_public_idx on public.availability(status, starts_at) where status = 'OPEN';
create index booking_holds_expiry_idx on public.booking_holds(expires_at);
create index appointments_user_start_idx on public.appointments(user_id, starts_at desc);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index notification_outbox_queue_idx on public.notification_outbox(status, available_at) where status in ('PENDING','FAILED');
create index audit_logs_created_idx on public.audit_logs(created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

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
  elsif new.type = 'BOOLEAN' and jtype <> 'boolean' then
    raise exception 'Setting % must be a JSON boolean', new.key;
  elsif new.type in ('STRING','CURRENCY','URL') and jtype <> 'string' then
    raise exception 'Setting % must be a JSON string', new.key;
  elsif new.type = 'JSON' and jtype not in ('object','array','string','number','boolean','null') then
    raise exception 'Setting % must be valid JSON', new.key;
  end if;
  if new.type = 'CURRENCY' and (new.value #>> '{}') !~ '^[A-Z]{3}$' then raise exception 'Setting % must be an ISO currency code', new.key; end if;
  if new.type = 'URL' and (new.value #>> '{}') !~ '^https?://' then raise exception 'Setting % must be an http(s) URL', new.key; end if;
  if new.key='review.allowed_mime_types' and (jtype<>'array' or jsonb_array_length(new.value)=0 or exists(select 1 from jsonb_array_elements(new.value) x where jsonb_typeof(x.value)<>'string' or (x.value #>> '{}') !~ '^[a-z0-9.+-]+/[a-z0-9.+*-]+$')) then
    raise exception 'Review allowed MIME types must be a non-empty array of MIME type strings';
  end if;
  if new.allowed_values is not null and not (new.allowed_values @> jsonb_build_array(new.value)) then raise exception 'Setting % is not an allowed value', new.key; end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.check_price_version()
returns trigger language plpgsql set search_path = public as $$
declare p_id uuid := coalesce(new.product_id, old.product_id);
begin
  perform 1 from public.products where id = p_id for update;
  if new.country_code is not null and not exists(select 1 from public.countries c where c.code=new.country_code and c.currency_code=new.currency) then
    raise exception 'Price currency must match the configured currency for its country';
  end if;
  if tg_op = 'UPDATE' and exists (select 1 from public.orders o where o.price_id = old.id)
     and (new.product_id, new.amount, new.currency, new.country_code, new.billing_interval, new.billing_interval_count)
         is distinct from
         (old.product_id, old.amount, old.currency, old.country_code, old.billing_interval, old.billing_interval_count) then
    raise exception 'A price referenced by an order is immutable; create a new price version';
  end if;
  if new.status = 'ACTIVE' then
    if exists (
      select 1 from public.product_prices p
      where p.product_id = new.product_id and p.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and p.status = 'ACTIVE' and p.currency = new.currency
        and p.country_code is not distinct from new.country_code
        and p.billing_interval = new.billing_interval and p.billing_interval_count = new.billing_interval_count
        and coalesce(p.starts_at, '-infinity'::timestamptz) < coalesce(new.ends_at, 'infinity'::timestamptz)
        and coalesce(new.starts_at, '-infinity'::timestamptz) < coalesce(p.ends_at, 'infinity'::timestamptz)
    ) then raise exception 'Overlapping active price windows are not allowed'; end if;
  end if;
  return new;
end;
$$;
create trigger product_prices_version_guard before insert or update on public.product_prices for each row execute function public.check_price_version();
create trigger business_settings_validate before insert or update on public.business_settings for each row execute function public.validate_business_setting();

-- Keep both review buckets synchronized with the active, editable review limits.
-- Missing settings leave uploads unavailable at submit time; there is no fallback cap.
create or replace function public.sync_review_storage_settings()
returns trigger language plpgsql security definer set search_path = public, storage as $$
declare size_limit bigint; mime_list text[];
begin
  select (value #>> '{}')::bigint into size_limit from public.business_settings
    where key='review.video_max_size_bytes' and active;
  select array(select jsonb_array_elements_text(value)) into mime_list from public.business_settings
    where key='review.allowed_mime_types' and active and jsonb_typeof(value)='array';
  if size_limit is not null and size_limit > 0 and mime_list is not null and cardinality(mime_list)>0 then
    update storage.buckets set file_size_limit=size_limit, allowed_mime_types=mime_list
      where id in ('review-staging','review-videos');
  end if;
  return new;
end;
$$;
create trigger business_settings_review_storage_sync after insert or update on public.business_settings
  for each row when (new.key in ('review.video_max_size_bytes','review.allowed_mime_types'))
  execute function public.sync_review_storage_settings();

create or replace function public.prevent_required_review_setting_removal()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.key in ('review.video_max_size_bytes','review.video_max_duration_seconds','review.allowed_mime_types','review.validation_record_ttl_minutes','review.free_monthly_quantity','review.turnaround_hours','review.video_retention_days','review.scoring_max','booking.hold_lifetime_minutes','membership.expiring_within_days','notification.reminder_offsets_hours')
     and (tg_op='DELETE' or new.active is distinct from true) then
    raise exception 'Required operational setting % cannot be deleted or disabled; update its value instead', old.key;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
create trigger business_settings_required_guard before update or delete on public.business_settings
  for each row execute function public.prevent_required_review_setting_removal();

create or replace function public.validate_product_binding()
returns trigger language plpgsql set search_path = public as $$
declare product_type text; price_product uuid; price_interval text; interval_count integer;
begin
  if tg_table_name='courses' then
    if new.product_id is not null and not exists(select 1 from public.products p where p.id=new.product_id and p.type='COURSE') then
      raise exception 'Course product must have type COURSE';
    end if;
  elsif tg_table_name='membership_plans' then
    select p.type,pr.product_id,pr.billing_interval,pr.billing_interval_count
      into product_type,price_product,price_interval,interval_count
      from public.products p join public.product_prices pr on pr.id=new.price_id where p.id=new.product_id;
    if product_type is distinct from 'MEMBERSHIP' or price_product is distinct from new.product_id then
      raise exception 'Membership plan product and price must match a MEMBERSHIP product';
    end if;
    if (case price_interval when 'MONTH' then interval_count when 'YEAR' then interval_count*12 else 0 end) <> new.billing_months then
      raise exception 'Plan billing months must match its referenced price interval';
    end if;
  elsif tg_table_name='support_packages' then
    select p.type,pr.product_id,pr.billing_interval into product_type,price_product,price_interval
      from public.products p join public.product_prices pr on pr.id=new.price_id where p.id=new.product_id;
    if product_type is distinct from 'SUPPORT' or price_product is distinct from new.product_id or price_interval is distinct from 'ONCE' then
      raise exception 'Support package must reference its SUPPORT product and one-time price';
    end if;
  end if;
  return new;
end;
$$;
create trigger courses_product_binding before insert or update of product_id on public.courses for each row execute function public.validate_product_binding();
create trigger membership_product_binding before insert or update on public.membership_plans for each row execute function public.validate_product_binding();
create trigger support_product_binding before insert or update on public.support_packages for each row execute function public.validate_product_binding();

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare old_json jsonb; new_json jsonb; row_id text;
begin
  if tg_op <> 'INSERT' then old_json := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then new_json := to_jsonb(new); end if;
  row_id := coalesce(new_json ->> 'id', old_json ->> 'id', new_json ->> 'key', old_json ->> 'key', new_json ->> 'code', old_json ->> 'code', 'unknown');
  insert into public.audit_logs(actor_id, action, target, old_value, new_value)
  values (auth.uid(), tg_op, tg_table_name || ':' || row_id, old_json, new_json);
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name',''), coalesce(new.email,''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = old.id and not public.is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status or new.created_at is distinct from old.created_at then
      raise exception 'Profile identity, email, role and status are managed by trusted operations';
    end if;
  end if;
  if new.id is distinct from old.id or new.email is distinct from old.email then
    raise exception 'Profile identity and email are managed by Supabase Auth';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN' and p.status = 'ACTIVE');
$$;

create or replace function public.membership_grant_is_current(p_user_id uuid,p_period_start timestamptz,p_expires_at timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.subscriptions s
    where s.user_id=p_user_id and s.status in ('ACTIVE','EXPIRING','CANCELLED')
      and s.period_start<=now() and s.period_end>now()
      and s.period_start=p_period_start and s.period_end=p_expires_at)
$$;

create or replace function public.has_membership(p_user_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if p_user_id is null then return false; end if;
  if p_user_id <> auth.uid() and not public.is_admin() and auth.role() <> 'service_role' then return false; end if;
  if not exists(select 1 from public.profiles where id=p_user_id and status='ACTIVE') then return false; end if;
  return exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user_id and s.status in ('ACTIVE','EXPIRING','CANCELLED') and s.period_start <= now() and s.period_end > now()
  );
end;
$$;

create or replace function public.can_access_course(p_user_id uuid, p_course_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare c public.courses%rowtype;
begin
  if p_user_id is null or (p_user_id <> auth.uid() and not public.is_admin() and auth.role() <> 'service_role') then return false; end if;
  if not exists(select 1 from public.profiles where id=p_user_id and status='ACTIVE') then return false; end if;
  select * into c from public.courses where id = p_course_id;
  if not found or c.status = 'DRAFT' then return false; end if;
  if public.is_admin() then return true; end if;
  if c.access_type = 'FREE' then
    return exists(select 1 from public.enrollments e where e.user_id = p_user_id and e.course_id = c.id);
  elsif c.access_type = 'PURCHASE' then
    return exists(select 1 from public.entitlements e where e.user_id = p_user_id and e.product_id = c.product_id and e.kind in ('PURCHASE','ADMIN') and (e.expires_at is null or e.expires_at > now()));
  else
    return public.has_membership(p_user_id);
  end if;
end;
$$;

create or replace function public.guard_review_transition()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'PENDING' then raise exception 'New review submissions must start PENDING'; end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    if old.status = 'PENDING' and new.status = 'UNDER_REVIEW' then
      if new.reviewer_id is null then raise exception 'Assign a reviewer before starting review'; end if;
    elsif old.status = 'UNDER_REVIEW' and new.status = 'REVIEWED' then
      if not exists (select 1 from public.review_feedback f where f.submission_id = old.id) then raise exception 'Publish feedback before completing a review'; end if;
      new.completed_at := coalesce(new.completed_at, now());
    else
      raise exception 'Invalid review state transition: % to %', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;
create trigger review_transition_guard before insert or update on public.review_submissions for each row execute function public.guard_review_transition();

create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_fields();

create or replace function public.ensure_free_review_grant(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare month_start timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'; free_qty integer;
begin
  if p_user_id is null then return; end if;
  -- Serialize grant creation against concurrent balance/submission requests per user.
  perform 1 from public.profiles where id=p_user_id for update;
  if not found or public.has_membership(p_user_id) then return; end if;
  select (value #>> '{}')::integer into free_qty from public.business_settings where key = 'review.free_monthly_quantity' and active;
  if free_qty is null then raise exception 'Free monthly review allowance is not configured'; end if;
  if free_qty <= 0 then return; end if;
  insert into public.review_credit_grants(user_id, source, quantity, period_start, expires_at)
  values(p_user_id, 'FREE', free_qty, month_start, month_start + interval '1 month')
  on conflict (user_id,period_start) where source='FREE' do nothing;
end;
$$;

create or replace function public.enqueue_notification(p_user_id uuid,p_title text,p_body text,p_url text,p_event_key text)
returns uuid language plpgsql security definer set search_path = public as $$
declare notification_id uuid;
begin
  if p_user_id is null or nullif(trim(p_event_key),'') is null then raise exception 'Notification user and event key are required'; end if;
  insert into public.notifications(user_id,title,body,url,event_key)
  values(p_user_id,left(coalesce(p_title,''),240),coalesce(p_body,''),p_url,p_event_key)
  on conflict(user_id,event_key) do nothing returning id into notification_id;
  if notification_id is null then
    select id into notification_id from public.notifications where user_id=p_user_id and event_key=p_event_key;
  end if;
  -- In-app delivery is the durable notifications row; no EMAIL row is marked sent here.
  insert into public.notification_outbox(user_id,channel,status,payload,event_key,sent_at)
  values(p_user_id,'IN_APP','SENT',jsonb_build_object('notification_id',notification_id,'title',left(coalesce(p_title,''),240),'body',coalesce(p_body,''),'url',p_url),p_event_key,now())
  on conflict(channel,user_id,event_key) do nothing;
  return notification_id;
end;
$$;

create or replace function public.enroll_free(p_course_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.courses%rowtype; first_lesson uuid; enrollment_id uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles where id = uid and status = 'ACTIVE') then raise exception 'Active profile required'; end if;
  select * into c from public.courses where id = p_course_id and status = 'PUBLISHED' for share;
  if not found or c.access_type <> 'FREE' then raise exception 'Course is not available for free enrollment'; end if;
  select l.id into first_lesson from public.lessons l join public.course_modules m on m.id = l.module_id
    where m.course_id = c.id order by m.sort_order, l.sort_order limit 1;
  insert into public.enrollments(user_id, course_id, current_lesson_id)
  values(uid, c.id, first_lesson) on conflict (user_id, course_id) do update set course_id = excluded.course_id
  returning id into enrollment_id;
  perform public.enqueue_notification(uid,'Course enrollment confirmed','You are enrolled in “'||c.title||'”.','/student/courses/'||c.slug,'enrollment:'||enrollment_id);
  return enrollment_id;
end;
$$;

create or replace function public.complete_lesson(p_lesson_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); course_uuid uuid; next_lesson uuid; remaining integer; done_count integer; enrollment_uuid uuid; completion timestamptz;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select m.course_id into course_uuid from public.lessons l join public.course_modules m on m.id = l.module_id where l.id = p_lesson_id;
  if course_uuid is null or not public.can_access_course(uid, course_uuid) then raise exception 'Lesson access denied'; end if;
  insert into public.lesson_progress(user_id, lesson_id) values(uid, p_lesson_id) on conflict (user_id, lesson_id) do nothing;
  select l.id into next_lesson from public.lessons l join public.course_modules m on m.id = l.module_id
  where m.course_id = course_uuid and (m.sort_order, l.sort_order) > (
    select m2.sort_order, l2.sort_order from public.lessons l2 join public.course_modules m2 on m2.id = l2.module_id where l2.id = p_lesson_id
  ) order by m.sort_order, l.sort_order limit 1;
  select count(*) into remaining from public.lessons l join public.course_modules m on m.id = l.module_id
  where m.course_id = course_uuid and not exists(select 1 from public.lesson_progress lp where lp.user_id = uid and lp.lesson_id = l.id);
  select count(*) into done_count from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id join public.course_modules m on m.id = l.module_id where lp.user_id = uid and m.course_id = course_uuid;
  completion := case when remaining = 0 and done_count > 0 then now() else null end;
  insert into public.enrollments(user_id, course_id, current_lesson_id, completed_at)
  values(uid, course_uuid, next_lesson, completion)
  on conflict(user_id, course_id) do update set current_lesson_id = excluded.current_lesson_id, completed_at = coalesce(public.enrollments.completed_at, excluded.completed_at)
  returning id into enrollment_uuid;
  return jsonb_build_object('completed', true, 'course_id', course_uuid, 'current_lesson_id', next_lesson, 'completed_lessons', done_count, 'remaining_lessons', remaining, 'completed_at', completion);
end;
$$;

create or replace function public.review_balance()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); member_now boolean; grants jsonb; total integer;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles where id=uid and status='ACTIVE') then raise exception 'Active profile required'; end if;
  member_now := public.has_membership(uid);
  if not member_now then perform public.ensure_free_review_grant(uid); end if;
  select coalesce(sum(g.quantity-g.used),0)::integer into total from public.review_credit_grants g
  where g.user_id=uid and g.used<g.quantity and (g.expires_at is null or g.expires_at > now())
    and (g.source <> 'MEMBERSHIP' or public.membership_grant_is_current(g.user_id,g.period_start,g.expires_at))
    and (not member_now or g.source <> 'FREE');
  select coalesce(jsonb_agg(jsonb_build_object('source', g.source, 'available', g.quantity-g.used, 'expires_at', g.expires_at, 'period_start', g.period_start) order by g.expires_at nulls last, g.period_start), '[]'::jsonb)
    into grants from public.review_credit_grants g where g.user_id=uid and g.used<g.quantity and (g.expires_at is null or g.expires_at > now())
      and (g.source <> 'MEMBERSHIP' or public.membership_grant_is_current(g.user_id,g.period_start,g.expires_at)) and (not member_now or g.source <> 'FREE');
  return jsonb_build_object('available', total, 'membership_active', member_now, 'grants', grants,
    'limits', jsonb_build_object('max_video_duration_seconds', (select value from public.business_settings where key='review.video_max_duration_seconds' and active),
    'max_video_size_bytes', (select value from public.business_settings where key='review.video_max_size_bytes' and active),
    'turnaround_hours', (select value from public.business_settings where key='review.turnaround_hours' and active)));
end;
$$;

create or replace function public.submit_review(
  p_title text, p_project_category text, p_review_category text, p_description text, p_question text,
  p_video_path text, p_video_size bigint, p_video_duration numeric, p_mime_type text
) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); validation public.validated_uploads%rowtype; grant_row public.review_credit_grants%rowtype;
  submission_id uuid; max_size bigint; max_duration numeric; allowed jsonb; validation_ttl integer; member_now boolean;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles where id=uid and status='ACTIVE') then raise exception 'Active profile required'; end if;
  if p_video_path is null or p_video_path !~ ('^'||uid::text||'/[0-9a-fA-F-]{36}[.](mp4|webm|mov)$') then raise exception 'Invalid validated review video path'; end if;
  select (value #>> '{}')::integer into validation_ttl from public.business_settings where key='review.validation_record_ttl_minutes' and active;
  if validation_ttl is null or validation_ttl<=0 then raise exception 'Review upload validation lifetime is not configured'; end if;
  select * into validation from public.validated_uploads v where v.user_id=uid and v.video_path=p_video_path and not v.consumed
    and v.validated_at>now()-make_interval(mins=>validation_ttl) for update;
  if not found then raise exception 'Upload has not passed trusted server-side media validation'; end if;
  if p_video_size is distinct from validation.video_size or p_video_duration is distinct from validation.video_duration or p_mime_type is distinct from validation.mime_type then
    raise exception 'Submitted media metadata does not match the trusted validation record';
  end if;
  select (value #>> '{}')::bigint into max_size from public.business_settings where key='review.video_max_size_bytes' and active;
  select (value #>> '{}')::numeric into max_duration from public.business_settings where key='review.video_max_duration_seconds' and active;
  select value into allowed from public.business_settings where key='review.allowed_mime_types' and active;
  if max_size is null or max_size<=0 or max_duration is null or max_duration<=0 or allowed is null or jsonb_typeof(allowed)<>'array' or jsonb_array_length(allowed)=0 then
    raise exception 'Review video size, duration, and MIME limits must be configured';
  end if;
  if validation.video_size>max_size or validation.video_duration>max_duration then raise exception 'Validated upload exceeds current limits'; end if;
  if not (allowed @> jsonb_build_array(to_jsonb(validation.mime_type))) then raise exception 'Validated MIME type is no longer allowed'; end if;
  if not exists(select 1 from storage.objects where bucket_id='review-videos' and name=validation.video_path) then raise exception 'Validated private video is missing'; end if;
  if not exists(select 1 from public.review_categories where category=p_review_category and active) then raise exception 'Review category is unavailable'; end if;
  if not exists(select 1 from public.project_categories where category=p_project_category and active) then raise exception 'Project category is unavailable'; end if;
  perform public.ensure_free_review_grant(uid);
  member_now := public.has_membership(uid);
  select * into grant_row from public.review_credit_grants g where g.user_id=uid and g.used<g.quantity
    and (g.expires_at is null or g.expires_at>now())
    and (g.source <> 'MEMBERSHIP' or public.membership_grant_is_current(g.user_id,g.period_start,g.expires_at))
    and (not member_now or g.source <> 'FREE')
  order by g.expires_at nulls last, g.period_start nulls last, g.created_at for update skip locked limit 1;
  if not found then raise exception 'No review credits available'; end if;
  update public.review_credit_grants set used=used+1 where id=grant_row.id;
  insert into public.review_submissions(user_id,title,project_category,review_category,description,question,video_path,video_size,video_duration,mime_type)
  values(uid,trim(p_title),p_project_category,p_review_category,coalesce(p_description,''),coalesce(p_question,''),p_video_path,validation.video_size,validation.video_duration,validation.mime_type)
  returning id into submission_id;
  update public.validated_uploads set consumed=true where id=validation.id;
  return submission_id;
end;
$$;

create or replace function public.hold_slot(p_availability_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid:=auth.uid(); slot public.availability%rowtype; ttl integer; occupied integer; hold_id uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles where id=uid and status='ACTIVE') then raise exception 'Active profile required'; end if;
  select * into slot from public.availability where id=p_availability_id for update;
  if not found or slot.status<>'OPEN' or slot.starts_at<=now() then raise exception 'Availability is not bookable'; end if;
  if not exists(select 1 from public.support_packages p where p.id=slot.package_id and p.status='ACTIVE') then raise exception 'Support package is unavailable'; end if;
  select (value #>> '{}')::integer into ttl from public.business_settings where key='booking.hold_lifetime_minutes' and active;
  if ttl is null or ttl<=0 then raise exception 'Booking hold lifetime is not configured'; end if;
  select (select count(*) from public.appointments a where a.availability_id=slot.id and a.status in ('CONFIRMED','COMPLETED')) +
         (select count(*) from public.booking_holds h where h.availability_id=slot.id and h.expires_at>now()) into occupied;
  if occupied>=slot.capacity then raise exception 'Availability is full'; end if;
  insert into public.booking_holds(user_id,availability_id,expires_at) values(uid,slot.id,now()+make_interval(mins=>greatest(ttl,1))) returning id into hold_id;
  return hold_id;
end;
$$;

create or replace function public.cancel_membership(p_subscription_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid:=auth.uid(); result public.subscriptions%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  update public.subscriptions set cancel_at_period_end=true,status='CANCELLED',updated_at=now()
    where id=p_subscription_id and user_id=uid and status in ('ACTIVE','EXPIRING') and period_end>now()
    returning * into result;
  if not found then raise exception 'Membership cannot be cancelled'; end if;
  perform public.enqueue_notification(uid,'Membership cancellation scheduled','Your membership remains active through '||result.period_end::date::text||'.','/student/account','membership.cancelled:'||result.id);
  return jsonb_build_object('subscription_id',result.id,'status',result.status,'access_until',result.period_end,'cancel_at_period_end',true);
end;
$$;

create or replace function public.assert_service_role()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
end;
$$;

create or replace function public.fulfill_order(
  p_order_id uuid, p_provider text, p_reference text, p_amount bigint, p_currency text, p_event_key text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; plan public.membership_plans%rowtype; c public.courses%rowtype; pkg public.support_packages%rowtype;
        event_id uuid; payment_id uuid; sub_id uuid; ent_id uuid; appointment_id uuid; hold public.booking_holds%rowtype; slot public.availability%rowtype;
        product_kind text; plan_snapshot jsonb; plan_name text; plan_months integer; included_reviews integer; plan_benefits jsonb;
        period_start timestamptz; period_end timestamptz;
begin
  perform public.assert_service_role();
  if p_order_id is null or nullif(trim(p_provider),'') is null or nullif(trim(p_reference),'') is null or nullif(trim(p_event_key),'') is null then raise exception 'Verified payment identifiers are required'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if o.provider<>p_provider then raise exception 'Provider does not match order'; end if;
  if o.amount::bigint<>p_amount or o.currency<>p_currency then raise exception 'Verified amount or currency does not match order'; end if;
  if o.reference is null or o.reference<>p_reference then raise exception 'Verified provider reference does not exactly match the order reference'; end if;
  insert into public.payment_events(provider,event_key,payload) values(p_provider,p_event_key,jsonb_build_object('order_id',p_order_id,'reference',p_reference,'amount',p_amount,'currency',p_currency))
  on conflict(provider,event_key) do nothing returning id into event_id;
  if event_id is null then
    if exists(select 1 from public.payment_events e where e.provider=p_provider and e.event_key=p_event_key and e.payload->>'order_id'=p_order_id::text)
      and o.status='SUCCESS' then return jsonb_build_object('order_id',o.id,'status','SUCCESS','idempotent',true); end if;
    raise exception 'Payment event key was already used for another or incomplete fulfillment';
  end if;
  if o.status='SUCCESS' then
    if exists(select 1 from public.payments where order_id=o.id and provider=p_provider and reference=p_reference and status='SUCCESS') then
      return jsonb_build_object('order_id',o.id,'status','SUCCESS','idempotent',true);
    end if;
    raise exception 'Order already fulfilled with a different payment';
  end if;
  if o.status<>'PENDING' then raise exception 'Order is not pending'; end if;
  select type into product_kind from public.products where id=o.product_id;
  if not found then raise exception 'Product is unavailable'; end if;
  -- Order locks prevent duplicate fulfillment; user locks prevent overlapping renewal periods.
  perform 1 from public.profiles where id=o.user_id for update;
  insert into public.payments(order_id,user_id,provider,reference,status,amount,currency,verified_at)
  values(o.id,o.user_id,p_provider,p_reference,'SUCCESS',o.amount,o.currency,now()) returning id into payment_id;

  if product_kind='COURSE' then
    insert into public.entitlements(user_id,product_id,order_id,kind) values(o.user_id,o.product_id,o.id,'PURCHASE') returning id into ent_id;
    select * into c from public.courses where product_id=o.product_id;
    if found then
      insert into public.enrollments(user_id,course_id,current_lesson_id)
      values(o.user_id,c.id,(select l.id from public.lessons l join public.course_modules m on m.id=l.module_id where m.course_id=c.id order by m.sort_order,l.sort_order limit 1))
      on conflict(user_id,course_id) do nothing;
      perform public.enqueue_notification(o.user_id,'Course enrollment confirmed','Your purchase gives you access to “'||c.title||'”.','/student/courses/'||c.slug,'enrollment.order:'||o.id);
    end if;
  elsif product_kind='MEMBERSHIP' then
    if o.membership_plan_id is not null then select * into plan from public.membership_plans where id=o.membership_plan_id and product_id=o.product_id;
    else select * into plan from public.membership_plans where product_id=o.product_id and price_id=o.price_id order by created_at limit 1; end if;
    if not found then raise exception 'No matching membership plan for verified order'; end if;
    if (select product_id from public.product_prices where id=o.price_id)<>o.product_id then raise exception 'Membership price does not match order product'; end if;
    plan_snapshot := o.snapshot->'plan';
    if jsonb_typeof(plan_snapshot)<>'object'
       or jsonb_typeof(plan_snapshot->'billing_months')<>'number'
       or jsonb_typeof(plan_snapshot->'included_reviews')<>'number'
       or jsonb_typeof(plan_snapshot->'benefits') not in ('array','object') then
      raise exception 'Order is missing its immutable membership plan terms snapshot';
    end if;
    plan_months := (plan_snapshot->>'billing_months')::integer;
    included_reviews := (plan_snapshot->>'included_reviews')::integer;
    plan_benefits := plan_snapshot->'benefits';
    plan_name := coalesce(nullif(plan_snapshot->>'name',''),plan.name);
    if plan_months<=0 or included_reviews<0 then raise exception 'Order membership plan snapshot has invalid terms'; end if;
    select greatest(now(),coalesce(max(s.period_end),now())) into period_start from public.subscriptions s
      where s.user_id=o.user_id;
    period_end := period_start+make_interval(months=>plan_months);
    insert into public.subscriptions(user_id,plan_id,status,period_start,period_end,terms_snapshot)
    values(o.user_id,plan.id,'ACTIVE',period_start,period_end,jsonb_build_object('plan_name',plan_name,'billing_months',plan_months,'included_reviews',included_reviews,'benefits',plan_benefits,'price_id',o.price_id,'amount',o.amount,'currency',o.currency)) returning id into sub_id;
    insert into public.entitlements(user_id,product_id,order_id,expires_at,kind) values(o.user_id,o.product_id,o.id,period_end,'MEMBERSHIP') returning id into ent_id;
    if included_reviews>0 then
      insert into public.review_credit_grants(user_id,source,quantity,period_start,expires_at,order_id)
      values(o.user_id,'MEMBERSHIP',included_reviews,period_start,period_end,o.id);
    end if;
    perform public.enqueue_notification(o.user_id,'Membership active','Your '||plan_name||' membership is active through '||period_end::date::text||'.','/student/account','membership.paid:'||sub_id);
  elsif product_kind='REVIEW' then
    insert into public.review_credit_grants(user_id,source,quantity,order_id)
    select o.user_id,'PURCHASE',p.review_credit_quantity,o.id from public.products p where p.id=o.product_id;
  elsif product_kind='SUPPORT' then
    select * into hold from public.booking_holds where order_id=o.id for update;
    if not found or hold.expires_at<=now() then raise exception 'A live booking hold is required to fulfill support purchase'; end if;
    select * into slot from public.availability where id=hold.availability_id for update;
    if slot.status<>'OPEN' or slot.starts_at<=now() then raise exception 'Held support slot is no longer bookable'; end if;
    select * into pkg from public.support_packages where id=slot.package_id and product_id=o.product_id and status='ACTIVE';
    if not found then raise exception 'Support package does not match the held slot'; end if;
    if (select count(*) from public.appointments a where a.availability_id=slot.id and a.status in ('CONFIRMED','COMPLETED')) >= slot.capacity then raise exception 'Held support slot has reached capacity'; end if;
    insert into public.appointments(user_id,availability_id,package_id,order_id,status,starts_at,ends_at,meeting_url)
    values(o.user_id,slot.id,pkg.id,o.id,'CONFIRMED',slot.starts_at,slot.ends_at,slot.meeting_url) returning id into appointment_id;
    perform public.enqueue_notification(o.user_id,'Appointment confirmed','Your support appointment is confirmed for '||slot.starts_at::text||'.','/student/support','appointment.confirmed:'||appointment_id);
    delete from public.booking_holds where id=hold.id;
  end if;

  update public.orders set status='SUCCESS',updated_at=now(),
    snapshot=snapshot || jsonb_build_object('verified_payment',jsonb_build_object('provider',p_provider,'reference',p_reference,'amount',p_amount,'currency',p_currency,'verified_at',now()))
  where id=o.id;
  perform public.enqueue_notification(o.user_id,'Payment confirmed','Your payment has been verified.','/student/purchases','payment.success:'||o.id);
  return jsonb_build_object('order_id',o.id,'payment_id',payment_id,'entitlement_id',ent_id,'subscription_id',sub_id,'status','SUCCESS','idempotent',false);
end;
$$;

create or replace function public.platform_jobs()
returns jsonb language plpgsql security definer set search_path = public as $$
declare run_id uuid; expired_count integer:=0; expiring_count integer:=0; released_count integer; published_drops integer; published_events integer; published_announcements integer;
  reminders_count integer:=0; candidates jsonb; retention_days integer; expiring_days integer; reminder_offsets jsonb; reminder record; jobrow record; appointment_row record;
begin
  perform public.assert_service_role();
  select (value #>> '{}')::integer into expiring_days from public.business_settings where key='membership.expiring_within_days' and active;
  select value into reminder_offsets from public.business_settings where key='notification.reminder_offsets_hours' and active;
  select (value #>> '{}')::integer into retention_days from public.business_settings where key='review.video_retention_days' and active;
  if expiring_days is null or expiring_days<0 or retention_days is null or retention_days<0
     or reminder_offsets is null or jsonb_typeof(reminder_offsets)<>'array' then
    raise exception 'Membership, retention, and notification job settings must be configured';
  end if;
  if exists(select 1 from jsonb_array_elements(reminder_offsets) x
      where jsonb_typeof(x.value)<>'number' or (x.value #>> '{}')::numeric<0
        or (x.value #>> '{}')::numeric<>trunc((x.value #>> '{}')::numeric)) then
    raise exception 'Reminder offsets must be non-negative integer JSON numbers';
  end if;
  insert into public.job_runs(job_name,status,details) values('platform-jobs','RUNNING','{}'::jsonb) returning id into run_id;

  for jobrow in update public.subscriptions set status='EXPIRED',updated_at=now()
    where status in ('ACTIVE','EXPIRING','CANCELLED') and period_end<=now() returning id,user_id,period_end loop
    expired_count:=expired_count+1;
    perform public.enqueue_notification(jobrow.user_id,'Membership period ended','Your paid membership period has ended.','/student/account','membership.expired:'||jobrow.id);
  end loop;
  for jobrow in update public.subscriptions set status='EXPIRING',updated_at=now()
    where status='ACTIVE' and period_end>now() and period_end<=now()+make_interval(days=>expiring_days) returning id,user_id,period_end loop
    expiring_count:=expiring_count+1;
    perform public.enqueue_notification(jobrow.user_id,'Membership period ending soon','Your membership period ends on '||jobrow.period_end::date::text||'.','/student/account','membership.expiring:'||jobrow.id);
  end loop;

  for reminder in select (value #>> '{}')::integer as offset_hours from jsonb_array_elements(reminder_offsets) loop
    for appointment_row in select a.id,a.user_id,a.starts_at from public.appointments a
      where a.status='CONFIRMED'
        and a.starts_at>=now()+make_interval(hours=>reminder.offset_hours)
        and a.starts_at<now()+make_interval(hours=>reminder.offset_hours)+interval '5 minutes'
      order by a.starts_at limit 500 loop
      perform public.enqueue_notification(appointment_row.user_id,'Appointment reminder',
        'Your support appointment starts at '||appointment_row.starts_at::text||'.','/student/support',
        'appointment.reminder:'||appointment_row.id||':'||reminder.offset_hours);
      reminders_count:=reminders_count+1;
    end loop;
  end loop;

  update public.orders o set status='CANCELLED',updated_at=now()
  where o.status='PENDING' and exists(select 1 from public.booking_holds h where h.order_id=o.id and h.expires_at<=now());
  delete from public.booking_holds where expires_at<=now(); get diagnostics released_count=row_count;

  update public.ai_drops set status='PUBLISHED',updated_at=now() where status='DRAFT' and publish_at is not null and publish_at<=now(); get diagnostics published_drops=row_count;
  update public.events set status='PUBLISHED',updated_at=now() where status='DRAFT' and publish_at is not null and publish_at<=now(); get diagnostics published_events=row_count;
  update public.announcements set status='PUBLISHED',updated_at=now() where status='DRAFT' and publish_at is not null and publish_at<=now(); get diagnostics published_announcements=row_count;

  select coalesce(jsonb_agg(jsonb_build_object('submission_id',s.id,'video_path',s.video_path)), '[]'::jsonb) into candidates
  from (select id,video_path from public.review_submissions where status='REVIEWED'
    and completed_at<=now()-make_interval(days=>retention_days) and video_path is not null and video_deleted_at is null
    order by completed_at limit 100) s;

  update public.job_runs set details=jsonb_build_object('expired_subscriptions',expired_count,'expiring_subscriptions',expiring_count,
    'released_holds',released_count,'published_ai_drops',published_drops,'published_events',published_events,
    'published_announcements',published_announcements,'appointment_reminders_queued',reminders_count,
    'review_video_cleanup_candidates',jsonb_array_length(candidates)) where id=run_id;
  return jsonb_build_object('run_id',run_id,'review_video_cleanup',candidates,
    'counts',jsonb_build_object('expired_subscriptions',expired_count,'expiring_subscriptions',expiring_count,'released_holds',released_count,
      'published_ai_drops',published_drops,'published_events',published_events,'published_announcements',published_announcements,
      'appointment_reminders_queued',reminders_count));
end;
$$;

create or replace function public.complete_review_video_cleanup(p_run_id uuid, p_deleted_submission_ids uuid[], p_failed_submission_ids uuid[] default '{}'::uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare marked integer;
begin
  perform public.assert_service_role();
  update public.review_submissions set video_path=null,video_deleted_at=now()
    where id=any(coalesce(p_deleted_submission_ids,'{}'::uuid[])) and status='REVIEWED' and video_path is not null and completed_at is not null and video_deleted_at is null;
  get diagnostics marked=row_count;
  update public.job_runs set status=case when coalesce(array_length(p_failed_submission_ids,1),0)>0 then 'PARTIAL' else 'SUCCEEDED' end,
    finished_at=now(),details=details || jsonb_build_object('videos_deleted',marked,'video_delete_failures',coalesce(array_length(p_failed_submission_ids,1),0))
    where id=p_run_id and job_name='platform-jobs';
  return jsonb_build_object('metadata_marked_deleted',marked,'failures',coalesce(array_length(p_failed_submission_ids,1),0));
end;
$$;

-- Track important administrator and trusted lifecycle edits in an append-only audit table.
do $$
declare t text;
begin
  foreach t in array array['profiles','countries','currencies','business_settings','products','product_prices','payment_providers','payment_provider_countries','membership_plans','courses','course_modules','lessons','course_resources','review_categories','project_categories','review_scoring_criteria','review_credit_grants','review_submissions','review_feedback','support_packages','availability','appointments','ai_drops','events','event_private_links','announcements','points_rules','badges','user_badges'] loop
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t, t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','products','payment_providers','membership_plans','courses','ai_drops','events','event_private_links','announcements','support_packages','review_feedback','appointments','notifications','business_settings'] loop
    execute format('create trigger touch_%I before update on public.%I for each row execute function public.touch_updated_at()',t,t);
  end loop;
end $$;

-- Every public-schema table is RLS protected, including internal ledgers and trusted validation records.
do $$declare t record; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table public.%I enable row level security',t.tablename);
  end loop;
end $$;

create policy profile_self_select on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin());
create policy profile_self_update on public.profiles for update to authenticated using (id=auth.uid() or public.is_admin()) with check (id=auth.uid() or public.is_admin());
create policy profile_admin_insert on public.profiles for insert to authenticated with check (public.is_admin());
create policy currency_public_read on public.currencies for select to anon,authenticated using (true);
create policy currency_admin_write on public.currencies for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy country_public_read on public.countries for select to anon,authenticated using (active or public.is_admin());
create policy country_admin_write on public.countries for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy settings_public_read on public.business_settings for select to anon,authenticated using (active and is_public or public.is_admin());
create policy settings_admin_write on public.business_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_public_read on public.products for select to anon,authenticated using ((status='ACTIVE') or public.is_admin());
create policy products_admin_write on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy prices_public_read on public.product_prices for select to anon,authenticated using (status='ACTIVE' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) or public.is_admin());
create policy prices_admin_write on public.product_prices for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy providers_public_read on public.payment_providers for select to authenticated using (enabled or public.is_admin());
create policy providers_admin_write on public.payment_providers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy provider_countries_admin on public.payment_provider_countries for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy membership_plans_public_read on public.membership_plans for select to anon,authenticated using ((status='ACTIVE' and exists(select 1 from public.products p where p.id=product_id and p.status='ACTIVE')) or public.is_admin());
create policy membership_plans_admin_write on public.membership_plans for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy courses_public_catalog on public.courses for select to anon,authenticated using (status='PUBLISHED' or (auth.uid() is not null and public.can_access_course(auth.uid(),id)) or public.is_admin());
create policy courses_admin_write on public.courses for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy modules_content_access on public.course_modules for select to authenticated using (public.can_access_course(auth.uid(),course_id) or public.is_admin());
create policy modules_admin_write on public.course_modules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy lessons_content_access on public.lessons for select to authenticated using (exists(select 1 from public.course_modules m where m.id=module_id and public.can_access_course(auth.uid(),m.course_id)) or public.is_admin());
create policy lessons_admin_write on public.lessons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy resources_content_access on public.course_resources for select to authenticated using (public.can_access_course(auth.uid(),course_id) or public.is_admin());
create policy resources_admin_write on public.course_resources for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy enrollments_owner_read on public.enrollments for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy enrollments_admin_write on public.enrollments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy progress_owner_read on public.lesson_progress for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy progress_admin_write on public.lesson_progress for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy orders_owner_read on public.orders for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy payments_owner_read on public.payments for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy payment_events_admin_read on public.payment_events for select to authenticated using (public.is_admin());
create policy subscriptions_owner_read on public.subscriptions for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy subscriptions_admin_write on public.subscriptions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy entitlements_owner_read on public.entitlements for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy entitlements_admin_write on public.entitlements for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy project_categories_read on public.project_categories for select to anon,authenticated using (active or public.is_admin());
create policy project_categories_admin on public.project_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy review_categories_read on public.review_categories for select to anon,authenticated using (active or public.is_admin());
create policy review_categories_admin on public.review_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy review_criteria_read on public.review_scoring_criteria for select to authenticated using (active or public.is_admin());
create policy review_criteria_admin on public.review_scoring_criteria for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy grants_owner_read on public.review_credit_grants for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy grants_admin_manage on public.review_credit_grants for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy submissions_owner_read on public.review_submissions for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy submissions_admin_manage on public.review_submissions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy feedback_owner_published_read on public.review_feedback for select to authenticated using (public.is_admin() or exists(select 1 from public.review_submissions s where s.id=submission_id and s.user_id=auth.uid() and s.status='REVIEWED'));
create policy feedback_admin_manage on public.review_feedback for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy packages_public_read on public.support_packages for select to anon,authenticated using ((status='ACTIVE') or public.is_admin());
create policy packages_admin_manage on public.support_packages for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy availability_admin_manage on public.availability for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy holds_owner_read on public.booking_holds for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy appointments_owner_read on public.appointments for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy appointments_admin_manage on public.appointments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy drops_public_or_member_read on public.ai_drops for select to anon,authenticated using (
  status='PUBLISHED' and (publish_at is null or publish_at<=now()) and (audience='PUBLIC' or public.has_membership(auth.uid())) or public.is_admin());
create policy drops_admin_manage on public.ai_drops for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy events_public_or_member_read on public.events for select to anon,authenticated using (
  status='PUBLISHED' and (publish_at is null or publish_at<=now()) and (audience='PUBLIC' or public.has_membership(auth.uid())) or public.is_admin());
create policy events_admin_manage on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy event_links_member_read on public.event_private_links for select to authenticated using (
  public.is_admin() or exists(select 1 from public.events e where e.id=event_id and e.status='PUBLISHED' and e.audience='MEMBERS' and (e.publish_at is null or e.publish_at<=now()) and public.has_membership(auth.uid())));
create policy event_links_admin_manage on public.event_private_links for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy announcements_public_or_member_read on public.announcements for select to anon,authenticated using (
  status='PUBLISHED' and (publish_at is null or publish_at<=now()) and (audience='PUBLIC' or public.has_membership(auth.uid())) or public.is_admin());
create policy announcements_admin_manage on public.announcements for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy notifications_owner_read on public.notifications for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy notifications_owner_update on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy outbox_admin_read on public.notification_outbox for select to authenticated using (public.is_admin());
create policy audit_admin_read on public.audit_logs for select to authenticated using (public.is_admin());
create policy points_rules_public_read on public.points_rules for select to authenticated using (active or public.is_admin());
create policy points_rules_admin_manage on public.points_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy points_owner_read on public.points_transactions for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy points_admin_manage on public.points_transactions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy badges_public_read on public.badges for select to authenticated using (active or public.is_admin());
create policy badges_admin_manage on public.badges for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy user_badges_owner_read on public.user_badges for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy user_badges_admin_manage on public.user_badges for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy job_runs_admin_read on public.job_runs for select to authenticated using (public.is_admin());

create view public.availability_public with (security_invoker=false) as
select a.id,a.package_id,a.starts_at,a.ends_at,a.capacity,
  greatest(a.capacity - (select count(*) from public.appointments ap where ap.availability_id=a.id and ap.status in ('CONFIRMED','COMPLETED'))::integer
    - (select count(*) from public.booking_holds h where h.availability_id=a.id and h.expires_at>now())::integer,0) as remaining_capacity
from public.availability a join public.support_packages p on p.id=a.package_id
where a.status='OPEN' and a.starts_at>now() and p.status='ACTIVE';

create view public.events_public with (security_invoker=false) as
select id,title,description,audience,status,publish_at,starts_at,ends_at,url,thumbnail_url,created_at
from public.events where status='PUBLISHED' and audience='PUBLIC' and (publish_at is null or publish_at<=now());

create view public.ai_drops_public with (security_invoker=false) as
select id,title,description,type,url,thumbnail_url,audience,status,publish_at,created_at
from public.ai_drops where status='PUBLISHED' and audience='PUBLIC' and (publish_at is null or publish_at<=now());

-- Stable parent/API contracts. The curriculum view is narrowly filtered and definer-security:
-- anonymous catalog clients see only module/lesson titles for published courses, never body or URLs.
create view public.public_events with (security_invoker=false) as
select id,title,description,audience,status,publish_at,starts_at,ends_at,url,thumbnail_url,created_at
from public.events where status='PUBLISHED' and audience='PUBLIC' and (publish_at is null or publish_at<=now());

create view public.public_availability with (security_invoker=false) as
select a.id,a.package_id,a.starts_at,a.ends_at,a.capacity,a.status,
  greatest(a.capacity - (select count(*) from public.appointments ap where ap.availability_id=a.id and ap.status in ('CONFIRMED','COMPLETED'))::integer
    - (select count(*) from public.booking_holds h where h.availability_id=a.id and h.expires_at>now())::integer,0) as remaining_capacity
from public.availability a join public.support_packages p on p.id=a.package_id
where a.status='OPEN' and a.starts_at>now() and p.status='ACTIVE';

create view public.public_curriculum with (security_invoker=false,security_barrier=true) as
select m.course_id,m.id as module_id,m.title as module_title,m.sort_order as module_sort_order,
       l.id as lesson_id,l.title as lesson_title,l.sort_order as lesson_sort_order
from public.course_modules m join public.lessons l on l.module_id=m.id
join public.courses c on c.id=m.course_id
where c.status='PUBLISHED';

-- Supabase Storage buckets: public only for non-sensitive media; review/support/course material remains private.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('course-thumbnails','course-thumbnails',true,10485760,array['image/jpeg','image/png','image/webp','image/avif']),
 ('course-assets','course-assets',false,104857600,array['image/jpeg','image/png','image/webp','image/avif','application/pdf','video/mp4','video/webm']),
 ('review-staging','review-staging',false,null::bigint,null::text[]),
 ('review-videos','review-videos',false,null::bigint,null::text[]),
 ('ai-drop-media','ai-drop-media',false,52428800,array['image/jpeg','image/png','image/webp','application/pdf','video/mp4','video/webm']),
 ('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy public_course_thumbnails_read on storage.objects for select to anon,authenticated using (bucket_id='course-thumbnails');
create policy admin_course_thumbnails_write on storage.objects for insert to authenticated with check (bucket_id='course-thumbnails' and public.is_admin());
create policy admin_course_thumbnails_update on storage.objects for update to authenticated using (bucket_id='course-thumbnails' and public.is_admin()) with check (bucket_id='course-thumbnails' and public.is_admin());
create policy admin_course_thumbnails_delete on storage.objects for delete to authenticated using (bucket_id='course-thumbnails' and public.is_admin());
create policy avatars_public_read on storage.objects for select to anon,authenticated using (bucket_id='avatars');
create policy avatar_owner_insert on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_owner_update on storage.objects for update to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_owner_delete on storage.objects for delete to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy protected_course_assets_read on storage.objects for select to authenticated using (
  bucket_id='course-assets' and (public.is_admin() or case when coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.can_access_course(auth.uid(),(storage.foldername(name))[1]::uuid) else false end));
create policy admin_course_assets_insert on storage.objects for insert to authenticated with check (bucket_id='course-assets' and public.is_admin());
create policy admin_course_assets_update on storage.objects for update to authenticated using (bucket_id='course-assets' and public.is_admin()) with check (bucket_id='course-assets' and public.is_admin());
create policy admin_course_assets_delete on storage.objects for delete to authenticated using (bucket_id='course-assets' and public.is_admin());
create policy review_staging_owner_insert on storage.objects for insert to authenticated with check (
  bucket_id='review-staging' and (storage.foldername(name))[1]=auth.uid()::text
  and exists(select 1 from public.business_settings s where s.key='review.video_max_size_bytes' and s.active)
  and exists(select 1 from public.business_settings s where s.key='review.allowed_mime_types' and s.active and jsonb_typeof(s.value)='array' and jsonb_array_length(s.value)>0));
create policy review_staging_owner_read on storage.objects for select to authenticated using (bucket_id='review-staging' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
create policy review_videos_admin_or_owner_read on storage.objects for select to authenticated using (
  bucket_id='review-videos' and (public.is_admin() or exists(select 1 from public.review_submissions s where s.user_id=auth.uid() and s.video_path=name)));
create policy ai_drop_media_read on storage.objects for select to anon,authenticated using (
  bucket_id='ai-drop-media' and case when coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    exists(select 1 from public.ai_drops d where d.id=(storage.foldername(name))[1]::uuid and d.status='PUBLISHED'
      and (d.publish_at is null or d.publish_at<=now()) and (d.audience='PUBLIC' or public.has_membership(auth.uid()))) else false end);
create policy ai_drop_media_admin_insert on storage.objects for insert to authenticated with check (bucket_id='ai-drop-media' and public.is_admin());
create policy ai_drop_media_admin_update on storage.objects for update to authenticated using (bucket_id='ai-drop-media' and public.is_admin()) with check (bucket_id='ai-drop-media' and public.is_admin());
create policy ai_drop_media_admin_delete on storage.objects for delete to authenticated using (bucket_id='ai-drop-media' and public.is_admin());

-- Supabase projects can have broad default grants. Clear them before rebuilding the explicit API.
revoke all on all tables in schema public from anon,authenticated;
revoke all on all functions in schema public from public,anon,authenticated;
-- Explicit privileges; RLS remains authoritative. Public sees only intentionally public rows/views.
grant usage on schema public to anon, authenticated, service_role;
grant select on public.currencies,public.countries,public.business_settings,public.products,public.product_prices,public.membership_plans,
  public.courses,public.review_categories,public.project_categories,public.support_packages,public.ai_drops,public.events,public.announcements to anon,authenticated;
grant select on public.profiles,public.payment_providers,public.payment_provider_countries,public.course_modules,public.lessons,public.course_resources,
  public.enrollments,public.lesson_progress,public.orders,public.subscriptions,public.entitlements,public.payments,public.payment_events,
  public.review_scoring_criteria,public.review_credit_grants,public.validated_uploads,public.review_submissions,public.review_feedback,
  public.availability,public.booking_holds,public.appointments,public.event_private_links,public.notifications,public.notification_outbox,
  public.audit_logs,public.points_rules,public.points_transactions,public.badges,public.user_badges,public.job_runs to authenticated;
grant select on public.availability_public,public.events_public,public.ai_drops_public to anon,authenticated;
grant select on public.public_events,public.public_availability,public.public_curriculum to anon,authenticated;
grant insert,update,delete on public.currencies,public.countries,public.business_settings,public.products,public.product_prices,
  public.payment_providers,public.payment_provider_countries,public.membership_plans,public.courses,public.course_modules,public.lessons,
  public.course_resources,public.review_categories,public.project_categories,public.review_scoring_criteria,public.review_credit_grants,
  public.review_submissions,public.review_feedback,public.support_packages,public.availability,public.appointments,public.ai_drops,
  public.events,public.event_private_links,public.announcements,public.subscriptions,public.entitlements,public.enrollments,
  public.lesson_progress,public.points_rules,public.points_transactions,public.badges,public.user_badges to authenticated;
grant update on public.profiles to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;

revoke all on function public.is_admin() from public,anon,authenticated;
revoke all on function public.has_membership(uuid) from public,anon,authenticated;
revoke all on function public.can_access_course(uuid,uuid) from public,anon,authenticated;
revoke all on function public.membership_grant_is_current(uuid,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.enqueue_notification(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.sync_review_storage_settings() from public,anon,authenticated;
revoke all on function public.prevent_required_review_setting_removal() from public,anon,authenticated;
revoke all on function public.touch_updated_at() from public,anon,authenticated;
revoke all on function public.validate_business_setting() from public,anon,authenticated;
revoke all on function public.check_price_version() from public,anon,authenticated;
revoke all on function public.validate_product_binding() from public,anon,authenticated;
revoke all on function public.audit_row_change() from public,anon,authenticated;
revoke all on function public.handle_new_auth_user() from public,anon,authenticated;
revoke all on function public.protect_profile_fields() from public,anon,authenticated;
revoke all on function public.guard_review_transition() from public,anon,authenticated;
revoke all on function public.enroll_free(uuid) from public;
revoke all on function public.complete_lesson(uuid) from public;
revoke all on function public.review_balance() from public;
revoke all on function public.submit_review(text,text,text,text,text,text,bigint,numeric,text) from public;
revoke all on function public.hold_slot(uuid) from public;
revoke all on function public.cancel_membership(uuid) from public;
revoke all on function public.fulfill_order(uuid,text,text,bigint,text,text) from public;
revoke all on function public.platform_jobs() from public;
revoke all on function public.complete_review_video_cleanup(uuid,uuid[],uuid[]) from public;
revoke all on function public.ensure_free_review_grant(uuid) from public,anon,authenticated,service_role;
revoke all on function public.assert_service_role() from public,anon,authenticated,service_role;
grant execute on function public.is_admin() to anon,authenticated,service_role;
grant execute on function public.has_membership(uuid) to anon,authenticated,service_role;
grant execute on function public.can_access_course(uuid,uuid) to anon,authenticated,service_role;
grant execute on function public.enroll_free(uuid) to authenticated;
grant execute on function public.complete_lesson(uuid) to authenticated;
grant execute on function public.review_balance() to authenticated;
grant execute on function public.submit_review(text,text,text,text,text,text,bigint,numeric,text) to authenticated;
grant execute on function public.hold_slot(uuid) to authenticated;
grant execute on function public.cancel_membership(uuid) to authenticated;
grant execute on function public.fulfill_order(uuid,text,text,bigint,text,text) to service_role;
grant execute on function public.platform_jobs() to service_role;
grant execute on function public.complete_review_video_cleanup(uuid,uuid[],uuid[]) to service_role;
grant execute on function public.ensure_free_review_grant(uuid) to service_role;

commit;
